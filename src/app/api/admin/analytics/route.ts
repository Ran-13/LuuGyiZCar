import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { getAnalyticsOverview } from "@/lib/site-analytics";

export const dynamic = "force-dynamic";

/** Admin-only first-party analytics overview (DAU, new users, page views). */
export async function GET(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;

  const overview = await getAnalyticsOverview();
  return NextResponse.json(overview, {
    headers: { "Cache-Control": "no-store" },
  });
}
