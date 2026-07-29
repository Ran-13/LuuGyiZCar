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
 * ExoClick Fullpage Interstitial — matches dashboard async tags:
 *
 *   <script src="https://a.pemsrv.com/ad-provider.js"></script>
 *   <ins class="eas…" data-zoneid="…"></ins>
 *   <script>AdProvider.push({serve:{}})</script>
 *
 * Must stay in the DOM for the whole listing-page session. Do NOT hide/remove
 * the <ins> based on height — interstitial hooks are intentionally empty until
 * a link click; a watchdog that does `display:none` when height≈0 kills the
 * click interceptor (the previous bug).
 *
 * Video cards use a real <a href> (hard navigation) so "Clicking on Links" can fire.
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
    // Script may still be loading — queue again when it arrives / shortly after.
    const t1 = window.setTimeout(queueAdServe, 400);
    const t2 = window.setTimeout(queueAdServe, 1500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [key]);

  if (active.length === 0) return null;

  return (
    <>
      {active.map((slot) => {
        const zone = network.zones[slot];
        return (
          // Off-screen hook only — must remain in the DOM and must NOT use
          // pointer-events-none (that blocked ExoClick's click capture).
          <ins
            key={slot}
            className={resolveInsClass(zone, network)}
            data-zoneid={zone.zoneId}
            data-exo-interstitial={slot}
            style={{
              position: "absolute",
              left: "-10000px",
              top: "0",
              width: "1px",
              height: "1px",
              overflow: "hidden",
            }}
          />
        );
      })}
    </>
  );
}
