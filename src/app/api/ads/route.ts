import { NextResponse } from "next/server";
import { readAdsConfig } from "@/lib/ads";

/** Public read of announcement + banners for the site UI. */
export async function GET() {
  const config = await readAdsConfig();
  return NextResponse.json(config, {
    headers: {
      "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30",
    },
  });
}
