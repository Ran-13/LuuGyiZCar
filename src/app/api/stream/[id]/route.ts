import { NextResponse } from "next/server";
import { readAdsConfig } from "@/lib/ads";
import {
  findQuality,
  isEpornerVideoId,
  pickDefaultQuality,
  resolvePlayback,
  type StreamQuality,
} from "@/lib/eporner-stream";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
/** Long-running byte proxy for video Range requests. */
export const maxDuration = 300;

/** Scrubbing fires many Range hits — keep this high so seeks do not 429. */
const RATE_LIMIT = 900;
const RATE_WINDOW_MS = 60_000;

const UPSTREAM_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

function isAllowedClient(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "none") return true;

  const referer = request.headers.get("referer");
  if (!referer) {
    // Some mobile players omit Referer on Range follow-ups; allow same-origin
    // Sec-Fetch-Dest=video/empty when site header is missing.
    const dest = request.headers.get("sec-fetch-dest");
    return dest === "video" || dest === "empty";
  }
  try {
    const ref = new URL(referer);
    const here = new URL(request.url);
    return ref.origin === here.origin;
  } catch {
    return false;
  }
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function pickUpstream(
  request: Request,
  id: string,
): Promise<{ quality: StreamQuality } | NextResponse> {
  const playback = await resolvePlayback(id);
  if (!playback || playback.qualities.length === 0) {
    return NextResponse.json(
      { error: "Stream unavailable", code: "NO_SOURCES" },
      { status: 502 },
    );
  }

  const wanted = new URL(request.url).searchParams.get("q");
  const quality =
    findQuality(playback.qualities, wanted) ?? pickDefaultQuality(playback.qualities);

  if (!quality) {
    return NextResponse.json({ error: "Quality not found", code: "NO_QUALITY" }, { status: 404 });
  }
  return { quality };
}

function proxyHeaders(upstream: Response, qualityLabel: string): Headers {
  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") || "video/mp4");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Stream-Quality", qualityLabel);
  // Prevent nginx from buffering the whole segment (breaks smooth seek).
  headers.set("X-Accel-Buffering", "no");

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);
  const etag = upstream.headers.get("etag");
  if (etag) headers.set("ETag", etag);
  const lastModified = upstream.headers.get("last-modified");
  if (lastModified) headers.set("Last-Modified", lastModified);

  return headers;
}

async function fetchUpstream(
  id: string,
  quality: StreamQuality,
  range: string | null,
  method: "GET" | "HEAD",
): Promise<Response> {
  const upstreamHeaders: Record<string, string> = {
    "User-Agent": UPSTREAM_UA,
    Referer: `https://www.eporner.com/embed/${id}/`,
    Accept: "*/*",
    Connection: "keep-alive",
  };
  if (range) upstreamHeaders.Range = range;

  return fetch(quality.upstreamUrl, {
    method,
    headers: upstreamHeaders,
    redirect: "follow",
    cache: "no-store",
  });
}

/**
 * Proxies Eporner MP4 bytes through this VPS so viewers in blocked regions
 * can play + seek. Supports HTTP Range (206) for scrubbing/resume.
 */
export async function GET(request: Request, context: RouteContext) {
  if (!isAllowedClient(request)) {
    return NextResponse.json({ error: "Forbidden", code: "CROSS_ORIGIN" }, { status: 403 });
  }

  const ads = await readAdsConfig();
  if (ads.playback?.proxyMode === "off") {
    return NextResponse.json({ error: "Proxy disabled", code: "PROXY_OFF" }, { status: 403 });
  }

  const limit = checkRateLimit(
    `stream:${getClientKey(request.headers)}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );
  if (!limit.allowed) {
    return new NextResponse(null, {
      status: 429,
      headers: {
        "Retry-After": String(limit.retryAfterSeconds),
        "Accept-Ranges": "bytes",
      },
    });
  }

  const { id } = await context.params;
  if (!isEpornerVideoId(id)) {
    return NextResponse.json({ error: "Invalid id", code: "BAD_ID" }, { status: 400 });
  }

  const picked = await pickUpstream(request, id);
  if (picked instanceof NextResponse) return picked;
  const { quality } = picked;

  const range = request.headers.get("range");

  let upstream: Response;
  try {
    upstream = await fetchUpstream(id, quality, range, "GET");
  } catch (err) {
    console.error(`[stream] upstream fetch failed id=${id} q=${quality.id}`, err);
    // Refresh signed URL once and retry (common after idle + seek).
    await resolvePlayback(id, { force: true });
    const retryPick = await pickUpstream(request, id);
    if (retryPick instanceof NextResponse) return retryPick;
    try {
      upstream = await fetchUpstream(id, retryPick.quality, range, "GET");
    } catch (err2) {
      console.error(`[stream] retry failed id=${id}`, err2);
      return NextResponse.json({ error: "Upstream error", code: "UPSTREAM" }, { status: 502 });
    }
  }

  // Expired CDN token often returns 403/404 — force refresh once.
  if (upstream.status === 403 || upstream.status === 404) {
    await resolvePlayback(id, { force: true });
    const retryPick = await pickUpstream(request, id);
    if (!(retryPick instanceof NextResponse)) {
      try {
        upstream = await fetchUpstream(id, retryPick.quality, range, "GET");
      } catch {
        /* fall through */
      }
    }
  }

  if (!(upstream.status === 200 || upstream.status === 206)) {
    console.error(`[stream] upstream status ${upstream.status} id=${id} q=${quality.id}`);
    return NextResponse.json(
      { error: "Upstream rejected", code: "UPSTREAM_STATUS" },
      { status: 502 },
    );
  }

  // If client asked for a Range but upstream ignored it, do not pretend — browsers
  // break seek when they get 200 for a ranged request without Content-Range.
  if (range && upstream.status === 200 && !upstream.headers.get("content-range")) {
    console.error(`[stream] missing Content-Range for ranged request id=${id}`);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: proxyHeaders(upstream, quality.label),
  });
}

/** Chrome often HEADs the media URL before seeking — must advertise size + ranges. */
export async function HEAD(request: Request, context: RouteContext) {
  if (!isAllowedClient(request)) {
    return new NextResponse(null, { status: 403 });
  }

  const ads = await readAdsConfig();
  if (ads.playback?.proxyMode === "off") {
    return new NextResponse(null, { status: 403 });
  }

  const { id } = await context.params;
  if (!isEpornerVideoId(id)) {
    return new NextResponse(null, { status: 400 });
  }

  const picked = await pickUpstream(request, id);
  if (picked instanceof NextResponse) return picked;
  const { quality } = picked;

  try {
    let upstream = await fetchUpstream(id, quality, null, "HEAD");
    // Some CDNs reject HEAD or omit Content-Length — probe with a 1-byte Range GET.
    if (!upstream.ok || !upstream.headers.get("content-length")) {
      const probe = await fetchUpstream(id, quality, "bytes=0-0", "GET");
      if (probe.status === 206 || probe.status === 200) {
        const headers = proxyHeaders(probe, quality.label);
        // Prefer full size from Content-Range: bytes 0-0/TOTAL
        const cr = probe.headers.get("content-range");
        const total = cr?.match(/\/(\d+)\s*$/)?.[1];
        if (total) headers.set("Content-Length", total);
        // Drain/cancel body — we only need headers for HEAD.
        void probe.body?.cancel();
        return new NextResponse(null, { status: 200, headers });
      }
    }
    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status });
    }
    return new NextResponse(null, {
      status: 200,
      headers: proxyHeaders(upstream, quality.label),
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
