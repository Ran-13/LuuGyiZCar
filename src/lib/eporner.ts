/**
 * Eporner public API v2 client.
 *
 * Docs: https://www.eporner.com/api/v2/
 * No auth required, but the API sends no CORS headers — every call in this app
 * must happen server-side (RSC or route handler), never from the browser.
 */

const API_BASE = "https://www.eporner.com/api/v2/video";

/** The API stops counting at 100k results, so anything past that page is empty. */
const MAX_INDEXABLE_RESULTS = 100_000;

const REQUEST_TIMEOUT_MS = 10_000;

/** Cache upstream responses for 15 min — the catalog moves slowly and the API is rate-limited. */
const REVALIDATE_SECONDS = 900;

export type ThumbSize = "small" | "medium" | "big";

export const SORT_ORDERS = [
  { value: "top-weekly", label: "Trending" },
  { value: "latest", label: "Newest" },
  { value: "most-popular", label: "Most Viewed" },
  { value: "top-rated", label: "Top Rated" },
  { value: "longest", label: "Longest" },
] as const;

export type SortOrder = (typeof SORT_ORDERS)[number]["value"];

export const DEFAULT_ORDER: SortOrder = "top-weekly";

export function isSortOrder(value: string | undefined): value is SortOrder {
  return SORT_ORDERS.some((o) => o.value === value);
}

export interface EpornerThumb {
  size: string;
  width: number;
  height: number;
  src: string;
}

export interface EpornerVideo {
  id: string;
  title: string;
  keywords: string;
  views: number;
  rate: string;
  url: string;
  added: string;
  length_sec: number;
  length_min: string;
  embed: string;
  default_thumb: EpornerThumb;
  thumbs: EpornerThumb[];
}

/** Raw upstream shape — fields are loosely typed because the API is inconsistent. */
interface RawSearchResponse {
  count?: number;
  start?: number;
  per_page?: number;
  page?: number;
  total_count?: number | string;
  total_pages?: number | string;
  videos?: EpornerVideo[];
}

export interface SearchResult {
  videos: EpornerVideo[];
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
  /** True when the upstream call failed — lets the UI show an error instead of "no results". */
  failed: boolean;
}

export interface SearchParams {
  query: string;
  page?: number;
  perPage?: number;
  order?: SortOrder;
  thumbsize?: ThumbSize;
}

/**
 * The API serves UTF-8 bytes re-encoded as individual Latin-1 codepoints, so
 * non-Latin titles arrive as mojibake ("ì¼ê³µ" instead of "얼공"). Reversing
 * that means reading each codepoint back as a byte and decoding as UTF-8.
 *
 * Bails out unchanged on anything that isn't a clean round-trip, so ASCII titles
 * and legitimately accented Latin text ("Café") are never touched.
 */
function decodeMojibake(str: string): string {
  for (const ch of str) {
    if (ch.codePointAt(0)! > 0xff) return str;
  }

  try {
    const bytes = Uint8Array.from(str, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Not valid UTF-8 — the string was genuine Latin-1 all along.
    return str;
  }
}

function normalizeVideo(video: EpornerVideo): EpornerVideo {
  return {
    ...video,
    title: decodeMojibake(video.title ?? ""),
    keywords: decodeMojibake(video.keywords ?? ""),
  };
}

function toInt(value: unknown, fallback = 0): number {
  // total_count arrives as a number on some queries and a string on others.
  const n = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function clampPage(value: unknown): number {
  const n = toInt(value, 1);
  return n < 1 ? 1 : Math.min(n, 1000);
}

const emptyResult = (page: number, perPage: number, failed: boolean): SearchResult => ({
  videos: [],
  page,
  perPage,
  totalCount: 0,
  totalPages: 0,
  failed,
});

export async function searchVideos({
  query,
  page = 1,
  perPage = 24,
  order = DEFAULT_ORDER,
  thumbsize = "big",
}: SearchParams): Promise<SearchResult> {
  const safePage = clampPage(page);
  const safePerPage = Math.min(Math.max(perPage, 1), 100);

  const url = new URL(`${API_BASE}/search/`);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(safePerPage));
  url.searchParams.set("page", String(safePage));
  url.searchParams.set("thumbsize", thumbsize);
  url.searchParams.set("order", order);
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!res.ok) {
      console.error(`[eporner] search failed ${res.status} for query="${query}" page=${safePage}`);
      return emptyResult(safePage, safePerPage, true);
    }

    const data = (await res.json()) as RawSearchResponse;
    const videos = Array.isArray(data.videos) ? data.videos.map(normalizeVideo) : [];

    // Recomputed rather than trusted: the upstream count can exceed what it will
    // actually serve, which would render pagination links that lead to empty pages.
    const totalCount = Math.min(toInt(data.total_count), MAX_INDEXABLE_RESULTS);
    const totalPages = Math.min(Math.ceil(totalCount / safePerPage), 1000);

    return { videos, page: safePage, perPage: safePerPage, totalCount, totalPages, failed: false };
  } catch (err) {
    console.error(`[eporner] search error for query="${query}" page=${safePage}`, err);
    return emptyResult(safePage, safePerPage, true);
  }
}

export async function getVideoById(
  id: string,
  thumbsize: ThumbSize = "big",
): Promise<EpornerVideo | null> {
  const url = new URL(`${API_BASE}/id/`);
  url.searchParams.set("id", id);
  url.searchParams.set("thumbsize", thumbsize);
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as Partial<EpornerVideo>;
    return data?.id ? normalizeVideo(data as EpornerVideo) : null;
  } catch (err) {
    console.error(`[eporner] id lookup error for id="${id}"`, err);
    return null;
  }
}

/** Splits the comma-separated `keywords` blob into usable tags, dropping title-length noise. */
export function parseKeywords(keywords: string, limit = 12): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const raw of keywords.split(",")) {
    const tag = raw.trim().toLowerCase();
    if (!tag || tag.length > 24 || tag.split(" ").length > 3) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= limit) break;
  }

  return tags;
}

const compactNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export function formatViews(views: number): string {
  return compactNumber.format(views);
}

export function formatRating(rate: string): number {
  const n = Number.parseFloat(rate);
  return Number.isFinite(n) ? n : 0;
}

export function formatAdded(added: string): string {
  // Upstream format: "2026-07-23 13:12:12" (not ISO — needs a T for Safari).
  const date = new Date(added.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return "";

  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}
