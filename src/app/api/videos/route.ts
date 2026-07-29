import { NextResponse } from "next/server";
import { DEFAULT_ORDER, clampPage, isSortOrder, searchVideos } from "@/lib/eporner";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";

/**
 * Internal proxy for the client-side infinite-scroll feeds.
 *
 * The upstream API sends no CORS headers, so the browser cannot call it directly;
 * paging here instead of via a page navigation keeps the embedded player alive.
 *
 * Guarded on two axes, because an unauthenticated proxy is otherwise free upstream
 * quota for anyone who finds it — and the upstream bans by IP, which would take the
 * whole site down.
 */

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

/** Default page size when the client omits per_page. */
const DEFAULT_PER_PAGE = 24;
const MAX_PER_PAGE = 50;

export async function GET(request: Request) {
  // Browsers always send Sec-Fetch-Site on fetch(); same-origin means it came
  // from our own pages. Absent header = non-browser client, which has no
  // legitimate reason to hit this endpoint.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== "same-origin") {
    return NextResponse.json({ error: "Forbidden", code: "CROSS_ORIGIN" }, { status: 403 });
  }

  const limit = checkRateLimit(getClientKey(request.headers), RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSeconds),
          "X-RateLimit-Limit": String(RATE_LIMIT),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  const { searchParams } = new URL(request.url);

  // An empty `q` is valid — upstream reads it as "the whole catalog", which is
  // what the trending feed uses. Only an absent param is an error.
  if (!searchParams.has("q")) {
    return NextResponse.json({ error: "Missing query", code: "MISSING_QUERY" }, { status: 400 });
  }
  const query = (searchParams.get("q") ?? "").trim();

  const page = clampPage(searchParams.get("page"));
  const perPageRaw = Number.parseInt(searchParams.get("per_page") ?? "", 10);
  const perPage = Number.isFinite(perPageRaw)
    ? Math.min(Math.max(perPageRaw, 1), MAX_PER_PAGE)
    : DEFAULT_PER_PAGE;

  const orderParam = searchParams.get("order") ?? undefined;
  const order = isSortOrder(orderParam) ? orderParam : DEFAULT_ORDER;

  const result = await searchVideos({ query, page, perPage, order });

  if (result.failed) {
    return NextResponse.json(
      { error: "Upstream request failed", code: "UPSTREAM_ERROR" },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      videos: result.videos,
      page: result.page,
      totalPages: result.totalPages,
      totalCount: result.totalCount,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
        "X-RateLimit-Limit": String(RATE_LIMIT),
        "X-RateLimit-Remaining": String(limit.remaining),
      },
    },
  );
}
