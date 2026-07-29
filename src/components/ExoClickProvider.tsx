"use client";

import Script from "next/script";
import type { AdNetworkConfig } from "@/lib/ads-types";
import { INTERSTITIAL_SLOTS, isValidZoneId } from "@/lib/ads-types";

declare global {
  interface Window {
    AdProvider?: unknown[];
  }
}

function queueAdServe(): void {
  if (typeof window === "undefined") return;
  window.AdProvider = window.AdProvider || [];
  window.AdProvider.push({ serve: {} });
}

/**
 * Loads ExoClick ad-provider.js once.
 *
 * Interstitial dashboard tags use a.pemsrv.com — use that host when any
 * interstitial zone is enabled so the script matches the zone's serving path.
 * Load afterInteractive so link-click handlers exist before the first tap.
 */
export default function ExoClickProvider({ network }: { network: AdNetworkConfig }) {
  if (!network?.enabled) return null;

  const hasAnyZone = Object.values(network.zones).some((zone) => zone.enabled && zone.zoneId);
  if (!hasAnyZone) return null;

  const hasInterstitial = INTERSTITIAL_SLOTS.some((slot) => {
    const zone = network.zones[slot];
    return zone?.enabled && isValidZoneId(zone.zoneId);
  });

  const src = hasInterstitial
    ? "https://a.pemsrv.com/ad-provider.js"
    : "https://a.magsrv.com/ad-provider.js";

  return (
    <Script
      id="exoclick-ad-provider"
      src={src}
      strategy={hasInterstitial ? "afterInteractive" : "lazyOnload"}
      onLoad={queueAdServe}
    />
  );
}
