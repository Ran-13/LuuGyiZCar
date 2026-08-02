"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { AdNetworkConfig } from "@/lib/ads-types";
import {
  STICKY_BANNER_SLOTS,
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
 * ExoClick Sticky Banner — fixed bottom bar on every page.
 *
 * Same async tag as other banners (ad-provider.js + <ins>). Create a
 * "Sticky Banner" zone in ExoClick; paste Zone ID + Ad tag class in admin.
 * z-index sits below the own-GIF sticky (z-50) so a direct sale can win.
 */
export default function ExoClickStickyBanner({ network }: { network: AdNetworkConfig }) {
  const pathname = usePathname();
  const servedKey = useRef<string | null>(null);

  const active = STICKY_BANNER_SLOTS.filter((slot) => {
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
    servedKey.current = key;
    queueAdServe();
    const t = window.setTimeout(queueAdServe, 600);
    return () => window.clearTimeout(t);
  }, [key, pathname]);

  if (active.length === 0) return null;

  return (
    <aside
      aria-label="Advertisement"
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 flex justify-center"
    >
      <div className="pointer-events-auto w-full max-w-lg overflow-hidden sm:max-w-xl">
        {active.map((slot) => {
          const zone = network.zones[slot];
          return (
            <ins
              key={`${slot}-${pathname}-${zone.zoneId}`}
              className={resolveInsClass(zone, network)}
              data-zoneid={zone.zoneId}
            />
          );
        })}
      </div>
    </aside>
  );
}
