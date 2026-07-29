"use client";

import { useEffect, useRef } from "react";
import type { AdNetworkConfig, NetworkSlotId } from "@/lib/ads-types";
import { EXOCLICK_INS_CLASS, isValidZoneId } from "@/lib/ads-types";

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
 * Renders a single ExoClick zone.
 *
 * The <ins> tag has to live in the top document: ad-provider.js creates its own
 * iframe internally, so wrapping this in a sandboxed iframe — the usual advice
 * for third-party ad scripts — would stop delivery entirely.
 */
export default function ExoClickZone({ network, slot, className = "" }: Props) {
  const zone = network?.zones?.[slot];
  const zoneId = zone?.zoneId ?? "";
  const active = Boolean(network?.enabled && zone?.enabled && isValidZoneId(zoneId));

  const servedZoneId = useRef<string | null>(null);

  useEffect(() => {
    if (!active) return;
    // A re-render must not queue the same zone twice, which would either
    // double-count an impression or leave an empty second placement.
    if (servedZoneId.current === zoneId) return;
    servedZoneId.current = zoneId;

    window.AdProvider = window.AdProvider || [];
    window.AdProvider.push({ serve: {} });
  }, [active, zoneId]);

  if (!active) return null;

  return (
    // Centered: a fixed-size creative (300x250 and similar) would otherwise sit
    // hard against the left edge of the full-width container on desktop.
    <aside
      aria-label="Advertisement"
      className={`flex justify-center overflow-hidden ${className}`}
    >
      <ins className={EXOCLICK_INS_CLASS} data-zoneid={zoneId} />
    </aside>
  );
}
