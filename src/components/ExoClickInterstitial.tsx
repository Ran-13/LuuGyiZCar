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
  const provider = window.AdProvider ?? [];
  window.AdProvider = provider;
  provider.push({ serve: {} });
}

/**
 * ExoClick fullpage interstitial tags.
 *
 * ExoClick's current dashboard issues the SAME tag format as banners
 * (ad-provider.js + <ins class="…" data-zoneid="…">) — including for
 * "Desktop/Mobile Fullpage Interstitial" zones. Each zone often has its
 * own `ins` class (e.g. eas6a97888e35 vs eas6a97888e33), so we resolve
 * class per zone.
 *
 * Belongs on LISTING pages (home, category, search). Trigger is configured
 * in the ExoClick zone (usually "Clicking on Links").
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
    queueAdServe();
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
