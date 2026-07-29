"use client";

import Script from "next/script";
import type { AdNetworkConfig } from "@/lib/ads-types";

/**
 * Loads ExoClick's shared provider script once per page.
 *
 * Every zone on the page is served by this single script, so it must not be
 * rendered per zone. `lazyOnload` keeps it off the critical path — the ad
 * network must not regress the LCP/TTFB work done elsewhere in this app.
 *
 * Renders nothing when the network is disabled, so a site that has not opted in
 * never even makes the request.
 */
export default function ExoClickProvider({ network }: { network: AdNetworkConfig }) {
  if (!network?.enabled) return null;

  const hasAnyZone = Object.values(network.zones).some((zone) => zone.enabled && zone.zoneId);
  if (!hasAnyZone) return null;

  return (
    <Script
      id="exoclick-ad-provider"
      src="https://a.magsrv.com/ad-provider.js"
      strategy="lazyOnload"
    />
  );
}
