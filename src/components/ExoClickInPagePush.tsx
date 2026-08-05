"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { AdNetworkConfig } from "@/lib/ads-types";
import {
  SITEWIDE_NETWORK_SLOTS,
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
 * ExoClick sitewide floating formats (In-Page Push, Multi Format, …).
 *
 * Same async tag as banners: ad-provider.js + <ins data-zoneid>. Position /
 * creative layout is configured in the ExoClick zone — the <ins> is only a hook.
 *
 * Mounted once from the root layout so it runs on every page (including video).
 */
export default function ExoClickInPagePush({ network }: { network: AdNetworkConfig }) {
  const pathname = usePathname();
  const servedKey = useRef<string | null>(null);

  const active = SITEWIDE_NETWORK_SLOTS.filter((slot) => {
    const zone = network?.zones?.[slot];
    return Boolean(network?.enabled && zone?.enabled && isValidZoneId(zone.zoneId));
  });

  const key = active
    .map((slot) => {
      const z = network.zones[slot];
      return `${slot}:${z.zoneId}:${resolveInsClass(z, network)}`;
    })
    .join("|");

  useEffect(() => {
    if (!key) return;
    // Re-serve on route change so soft navigations still get a push chance.
    servedKey.current = key;
    queueAdServe();
    const t = window.setTimeout(queueAdServe, 600);
    return () => window.clearTimeout(t);
  }, [key, pathname]);

  if (active.length === 0) return null;

  return (
    <>
      {active.map((slot) => {
        const zone = network.zones[slot];
        return (
          <ins
            key={`${slot}-${pathname}-${zone.zoneId}`}
            className={resolveInsClass(zone, network)}
            data-zoneid={zone.zoneId}
            data-exo-sitewide={slot}
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
