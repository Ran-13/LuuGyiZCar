import { NextResponse } from "next/server";
import { DEFAULT_ORDER, clampPage, isSortOrder, searchVideos } from "@/lib/eporner";

/**
 * Internal proxy for the client-side related-videos rail.
 *
 * The upstream API sends no CORS headers, so the browser cannot call it directly;
 * paging here instead of via a page navigation keeps the embedded player alive.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // An empty `q` is valid — upstream reads it as "the whole catalog", which is
  // what the trending feed uses. Only an absent param is an error.
  if (!searchParams.has("q")) {
    return NextResponse.json({ error: "Missing query", code: "MISSING_QUERY" }, { status: 400 });
  }
  const query = (searchParams.get("q") ?? "").trim();

  const page = clampPage(searchParams.get("page"));
  const perPageRaw = Number.parseInt(searchParams.get("per_page") ?? "", 10);
  const perPage = Number.isFinite(perPageRaw) ? Math.min(Math.max(perPageRaw, 1), 50) : 8;

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
    { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } },
  );
}
