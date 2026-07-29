"use client";

import { useEffect, useRef } from "react";
import type { AdNetworkConfig } from "@/lib/ads-types";
import {
  INTERSTITIAL_SLOTS,
  isValidZoneId,
  resolveInsClass,
} from "@/lib/ads-types";

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
 * ExoClick fullpage interstitial tags.
 *
 * Dashboard tags use ad-provider.js + <ins class data-zoneid> (same as banners).
 * Each zone often has its own ins class — resolved per zone.
 *
 * Must live on LISTING pages. Video cards use a real <a href> (hard navigation)
 * so ExoClick's "Clicking on Links" trigger can intercept before the browser
 * leaves the page. Next.js <Link> soft-nav skips that and the ad never shows.
 */
export default function ExoClickInterstitial({ network }: { network: AdNetworkConfig }) {
  const active = INTERSTITIAL_SLOTS.filter((slot) => {
    const zone = network?.zones?.[slot];
    return Boolean(network?.enabled && zone?.enabled && isValidZoneId(zone.zoneId));
  });

  const servedKey = useRef<string | null>(null);
  const key = active
    .map((slot) => {
      const z = network.zones[slot];
      return `${slot}:${z.zoneId}:${resolveInsClass(z, network)}`;
    })
    .join("|");

  useEffect(() => {
    if (!key) return;
    if (servedKey.current === key) return;
    servedKey.current = key;

    // Serve now (AdProvider queues if the script is still loading) and once more
    // shortly after, in case lazy script arrival raced the first push.
    queueAdServe();
    const t = window.setTimeout(queueAdServe, 800);
    return () => window.clearTimeout(t);
  }, [key]);

  if (active.length === 0) return null;

  return (
    <>
      {active.map((slot) => {
        const zone = network.zones[slot];
        return (
          <ins
            key={slot}
            className={resolveInsClass(zone, network)}
            data-zoneid={zone.zoneId}
          />
        );
      })}
    </>
  );
}
