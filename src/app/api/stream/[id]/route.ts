import { NextResponse } from "next/server";
import {
  findQuality,
  isEpornerVideoId,
  pickDefaultQuality,
  resolvePlayback,
} from "@/lib/eporner-stream";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
/** Long-running byte proxy for video Range requests. */
export const maxDuration = 300;

const RATE_LIMIT = 180;
const RATE_WINDOW_MS = 60_000;

const UPSTREAM_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

function isAllowedClient(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin") return true;

  // <video> on some mobile Chrome builds omits/varies Sec-Fetch-Site; allow
  // same-origin Referer as a second check so playback still works.
  const referer = request.headers.get("referer");
  if (!referer) return false;
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

/**
 * Proxies Eporner MP4 bytes through this VPS so viewers in blocked regions
 * (no direct CDN access) can still play. Supports HTTP Range for seeking.
 *
 * Query: `?q=360p` (format id or label). Default is 360p.
 */
export async function GET(request: Request, context: RouteContext) {
  if (!isAllowedClient(request)) {
    return NextResponse.json({ error: "Forbidden", code: "CROSS_ORIGIN" }, { status: 403 });
  }

  const limit = checkRateLimit(
    `stream:${getClientKey(request.headers)}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  const { id } = await context.params;
  if (!isEpornerVideoId(id)) {
    return NextResponse.json({ error: "Invalid id", code: "BAD_ID" }, { status: 400 });
  }

  const playback = await resolvePlayback(id);
  if (!playback || playback.qualities.length === 0) {
    return NextResponse.json(
      { error: "Stream unavailable", code: "NO_SOURCES" },
      { status: 502 },
    );
  }

  const { searchParams } = new URL(request.url);
  const wanted = searchParams.get("q");
  const quality =
    findQuality(playback.qualities, wanted) ?? pickDefaultQuality(playback.qualities);

  if (!quality) {
    return NextResponse.json({ error: "Quality not found", code: "NO_QUALITY" }, { status: 404 });
  }

  const range = request.headers.get("range");
  const upstreamHeaders: HeadersInit = {
    "User-Agent": UPSTREAM_UA,
    Referer: `https://www.eporner.com/embed/${id}/`,
    Accept: "*/*",
  };
  if (range) upstreamHeaders.Range = range;

  let upstream: Response;
  try {
    upstream = await fetch(quality.upstreamUrl, {
      headers: upstreamHeaders,
      redirect: "follow",
      // Streaming body — do not cache the whole file in Next's data cache.
      cache: "no-store",
    });
  } catch (err) {
    console.error(`[stream] upstream fetch failed id=${id} q=${quality.id}`, err);
    return NextResponse.json({ error: "Upstream error", code: "UPSTREAM" }, { status: 502 });
  }

  if (!(upstream.status === 200 || upstream.status === 206)) {
    console.error(`[stream] upstream status ${upstream.status} id=${id} q=${quality.id}`);
    return NextResponse.json(
      { error: "Upstream rejected", code: "UPSTREAM_STATUS" },
      { status: 502 },
    );
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") || "video/mp4");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=300");
  headers.set("X-Stream-Quality", quality.label);

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
