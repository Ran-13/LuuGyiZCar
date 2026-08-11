import { NextResponse } from "next/server";
import { readAdsConfig } from "@/lib/ads";
import {
  isEpornerVideoId,
  pickDefaultQuality,
  resolvePlayback,
} from "@/lib/eporner-stream";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Returns proxied quality list for the native player (no upstream CDN URLs).
 */
export async function GET(request: Request, context: RouteContext) {
  const fetchSite = request.headers.get("sec-fetch-site");
  const referer = request.headers.get("referer");
  let allowed = fetchSite === "same-origin";
  if (!allowed && referer) {
    try {
      allowed = new URL(referer).origin === new URL(request.url).origin;
    } catch {
      allowed = false;
    }
  }
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden", code: "CROSS_ORIGIN" }, { status: 403 });
  }

  const ads = await readAdsConfig();
  if (ads.playback?.proxyMode === "off") {
    return NextResponse.json(
      { ok: false, proxyDisabled: true, error: "Proxy disabled" },
      { status: 403 },
    );
  }

  const limit = checkRateLimit(
    `playback:${getClientKey(request.headers)}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { id } = await context.params;
  if (!isEpornerVideoId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const playback = await resolvePlayback(id);
  if (!playback) {
    return NextResponse.json({ error: "Unavailable", ok: false }, { status: 502 });
  }

  const preferred = pickDefaultQuality(playback.qualities);

  return NextResponse.json({
    ok: true,
    id,
    defaultQuality: preferred?.id ?? null,
    qualities: playback.qualities.map((q) => ({
      id: q.id,
      label: q.label,
      height: q.height,
      src: `/api/stream/${id}?q=${encodeURIComponent(q.id)}`,
    })),
  });
}
