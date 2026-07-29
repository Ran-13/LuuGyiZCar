"use client";

import { useEffect, useRef } from "react";
import type { AdNetworkConfig } from "@/lib/ads-types";
import { EXOCLICK_INS_CLASS, INTERSTITIAL_SLOTS, isValidZoneId } from "@/lib/ads-types";

declare global {
  interface Window {
    AdProvider?: unknown[];
  }
}

/**
 * Queues a serve pass for every unprocessed <ins> on the page.
 *
 * Kept out of the component body: `react-hooks/immutability` rejects assigning
 * to an outer value (here `window`) inside a component or hook.
 */
function queueAdServe(): void {
  const provider = window.AdProvider ?? [];
  window.AdProvider = provider;
  provider.push({ serve: {} });
}

/**
 * ExoClick fullpage interstitial tags.
 *
 * Belongs on LISTING pages (home, category, search), not the video page. The
 * zone's Trigger Method is "Clicking on Links": ExoClick's script intercepts a
 * link click on the page the tag lives on, shows the ad, then continues to the
 * destination. Putting the tag on the video page would instead fire it when
 * leaving that page, which is not what a "between grid and video" ad means.
 *
 * Desktop and mobile are separate zone TYPES in ExoClick, so both ids render;
 * each zone only serves on its matching device.
 *
 * Frequency is deliberately not handled here — the zone's own Capping setting
 * enforces it server-side. Duplicating that in localStorage would give two
 * competing gates and make "why is no ad showing" impossible to reason about.
 */
export default function ExoClickInterstitial({ network }: { network: AdNetworkConfig }) {
  const active = INTERSTITIAL_SLOTS.filter((slot) => {
    const zone = network?.zones?.[slot];
    return Boolean(network?.enabled && zone?.enabled && isValidZoneId(zone.zoneId));
  });

  const servedKey = useRef<string | null>(null);
  const key = active.map((slot) => network.zones[slot].zoneId).join(",");

  useEffect(() => {
    if (!key) return;
    // A re-render must not queue the same zones twice.
    if (servedKey.current === key) return;
    servedKey.current = key;

    queueAdServe();
  }, [key]);

  if (active.length === 0) return null;

  return (
    <>
      {active.map((slot) => (
        <ins
          key={slot}
          className={network.insClass || EXOCLICK_INS_CLASS}
          data-zoneid={network.zones[slot].zoneId}
        />
      ))}
    </>
  );
}
