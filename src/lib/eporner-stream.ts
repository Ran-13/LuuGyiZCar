import { cache } from "react";

/**
 * Resolve playable Eporner MP4 URLs on the server (VPS), then serve them through
 * our `/api/stream` proxy. CDN links are IP-bound to the resolver — clients in
 * blocked regions cannot use them directly, which is why the proxy exists.
 *
 * Hash algorithm matches yt-dlp's Eporner extractor (from vjs.js).
 */

const EMBED_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

const REQUEST_TIMEOUT_MS = 12_000;
/** Source URLs expire; keep short so we refresh signed CDN paths. */
const SOURCE_REVALIDATE_SECONDS = 600;

export type StreamQuality = {
  /** e.g. "360p" */
  id: string;
  height: number;
  label: string;
  /** Upstream CDN URL — never send this to the browser. */
  upstreamUrl: string;
};

export type PlaybackInfo = {
  id: string;
  qualities: StreamQuality[];
};

const ID_RE = /^[A-Za-z0-9]+$/;

export function isEpornerVideoId(id: string): boolean {
  return ID_RE.test(id) && id.length >= 6 && id.length <= 32;
}

/** Base36 encode (yt-dlp encode_base_n). */
function encodeBase36(n: number): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  if (n === 0) return "0";
  let x = n;
  let out = "";
  while (x > 0) {
    out = chars[x % 36] + out;
    x = Math.floor(x / 36);
  }
  return out;
}

/** Reverse-engineered from Eporner vjs — 32-hex hash → xhr query hash. */
export function calcEpornerXhrHash(hex32: string): string {
  let out = "";
  for (let i = 0; i < 32; i += 8) {
    out += encodeBase36(Number.parseInt(hex32.slice(i, i + 8), 16));
  }
  return out;
}

function heightFromFormatId(formatId: string): number {
  const m = formatId.match(/(\d+)\s*p/i);
  return m ? Number.parseInt(m[1], 10) : 0;
}

async function fetchEmbedHash(id: string): Promise<string | null> {
  const res = await fetch(`https://www.eporner.com/embed/${id}/`, {
    headers: {
      "User-Agent": EMBED_UA,
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    next: { revalidate: SOURCE_REVALIDATE_SECONDS },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const m = html.match(/hash\s*[:=]\s*["']([\da-f]{32})/i);
  return m?.[1] ?? null;
}

type XhrSourceMap = Record<string, Record<string, { src?: string; type?: string }>>;

async function fetchXhrSources(id: string, xhrHash: string): Promise<XhrSourceMap | null> {
  const url = new URL(`https://www.eporner.com/xhr/video/${id}`);
  url.searchParams.set("hash", xhrHash);
  url.searchParams.set("device", "generic");
  url.searchParams.set("domain", "www.eporner.com");
  url.searchParams.set("fallback", "false");

  const res = await fetch(url, {
    headers: {
      "User-Agent": EMBED_UA,
      Referer: `https://www.eporner.com/embed/${id}/`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    // Signed URLs are IP + time bound — do not share cache across long periods.
    next: { revalidate: SOURCE_REVALIDATE_SECONDS },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    available?: boolean;
    sources?: XhrSourceMap;
  };
  if (data.available === false || !data.sources) return null;
  return data.sources;
}

function parseQualities(id: string, sources: XhrSourceMap): StreamQuality[] {
  const mp4 = sources.mp4;
  if (!mp4 || typeof mp4 !== "object") return [];

  const list: StreamQuality[] = [];
  for (const [formatId, meta] of Object.entries(mp4)) {
    const src = meta?.src;
    if (!src || !/^https:\/\//i.test(src)) continue;
    if (src.includes("na.mp4")) continue;
    const height = heightFromFormatId(formatId);
    list.push({
      id: formatId,
      height,
      label: height ? `${height}p` : formatId,
      upstreamUrl: src,
    });
  }

  list.sort((a, b) => b.height - a.height);
  return list;
}

/**
 * Resolve MP4 qualities for a video id. Cached per-request via React.cache;
 * fetch() still applies Next revalidate for cross-request reuse.
 */
export const resolvePlayback = cache(async function resolvePlayback(
  id: string,
): Promise<PlaybackInfo | null> {
  if (!isEpornerVideoId(id)) return null;

  try {
    const rawHash = await fetchEmbedHash(id);
    if (!rawHash) return null;
    const xhrHash = calcEpornerXhrHash(rawHash);
    const sources = await fetchXhrSources(id, xhrHash);
    if (!sources) return null;
    const qualities = parseQualities(id, sources);
    if (qualities.length === 0) return null;
    return { id, qualities };
  } catch (err) {
    console.error(`[eporner-stream] resolve failed id=${id}`, err);
    return null;
  }
});

/** Always start at 360p (fast start + lower VPS egress). Falls back nearby if missing. */
export function pickDefaultQuality(qualities: StreamQuality[]): StreamQuality | null {
  if (qualities.length === 0) return null;
  return (
    qualities.find((q) => q.height === 360) ??
    qualities.find((q) => q.id === "360p" || q.label === "360p") ??
    qualities.find((q) => q.height === 240) ??
    qualities.find((q) => q.height > 0 && q.height <= 480) ??
    qualities[qualities.length - 1]
  );
}

export function findQuality(
  qualities: StreamQuality[],
  qualityId: string | null | undefined,
): StreamQuality | null {
  if (!qualityId) return null;
  return qualities.find((q) => q.id === qualityId || q.label === qualityId) ?? null;
}
