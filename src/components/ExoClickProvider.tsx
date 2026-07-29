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
 * Loads ExoClick's shared provider script once per page.
 *
 * When any interstitial zone is active we use `afterInteractive` (not
 * lazyOnload) so the click interceptor is ready before the user taps a video
 * card. Soft-nav + a late script = interstitial never fires.
 */
export default function ExoClickProvider({ network }: { network: AdNetworkConfig }) {
  if (!network?.enabled) return null;

  const hasAnyZone = Object.values(network.zones).some((zone) => zone.enabled && zone.zoneId);
  if (!hasAnyZone) return null;

  const hasInterstitial = INTERSTITIAL_SLOTS.some((slot) => {
    const zone = network.zones[slot];
    return zone?.enabled && isValidZoneId(zone.zoneId);
  });

  return (
    <Script
      id="exoclick-ad-provider"
      src="https://a.magsrv.com/ad-provider.js"
      strategy={hasInterstitial ? "afterInteractive" : "lazyOnload"}
      onLoad={queueAdServe}
    />
  );
}
