import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import {
  getRequestIp,
  lookupCountryCode,
  readVpnWallPublicConfig,
} from "@/lib/vpn-wall";

/**
 * Admin-only diagnostics for the Myanmar VPN wall.
 * Open while on mobile data (no VPN) to verify IP + country detection.
 */
export async function GET(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;

  const ip = getRequestIp(request.headers);
  const country = await lookupCountryCode(ip);
  const wall = await readVpnWallPublicConfig();

  return NextResponse.json(
    {
      wall,
      ip: ip ?? null,
      country: country || null,
      wouldBlock: Boolean(
        wall.enabled && country && wall.blockedCountries.includes(country),
      ),
      headers: {
        "x-real-ip": request.headers.get("x-real-ip"),
        "x-forwarded-for": request.headers.get("x-forwarded-for"),
        trustProxy: process.env.TRUST_PROXY_HEADERS ?? null,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
