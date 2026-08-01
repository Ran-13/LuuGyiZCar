"use client";

import { useEffect, useRef } from "react";
import type { AdNetworkConfig, NetworkSlotId } from "@/lib/ads-types";
import { isValidZoneId, resolveInsClass } from "@/lib/ads-types";

declare global {
  interface Window {
    AdProvider?: unknown[];
  }
}

interface Props {
  network: AdNetworkConfig;
  slot: NetworkSlotId;
  className?: string;
}

/**
 * Renders a single ExoClick banner zone.
 *
 * Do not auto-hide after a "fill" timeout — many creatives (responsive, nested
 * iframes, delayed paint) fail a DOM size check even when they are showing.
 * Hiding then left a blank slot until a full page reload.
 */
export default function ExoClickZone({ network, slot, className = "" }: Props) {
  const zone = network?.zones?.[slot];
  const zoneId = zone?.zoneId ?? "";
  const active = Boolean(network?.enabled && zone?.enabled && isValidZoneId(zoneId));

  const servedZoneId = useRef<string | null>(null);

  useEffect(() => {
    if (!active) return;
    // A re-render must not queue the same zone twice.
    if (servedZoneId.current === zoneId) return;
    servedZoneId.current = zoneId;

    window.AdProvider = window.AdProvider || [];
    window.AdProvider.push({ serve: {} });
  }, [active, zoneId]);

  if (!active) return null;

  return (
    <aside
      aria-label="Advertisement"
      className={`flex min-h-0 justify-center overflow-hidden ${className}`}
    >
      <ins className={resolveInsClass(zone, network)} data-zoneid={zoneId} />
    </aside>
  );
}
