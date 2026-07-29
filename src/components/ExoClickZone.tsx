"use client";

import { useEffect, useRef, useState } from "react";
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
 * Safari Private / ITP often blocks the ad script — without a fill watchdog the
 * empty <aside> stays as a black "Advertisement" box. We hide the shell if no
 * creative arrives.
 */
export default function ExoClickZone({ network, slot, className = "" }: Props) {
  const zone = network?.zones?.[slot];
  const zoneId = zone?.zoneId ?? "";
  const active = Boolean(network?.enabled && zone?.enabled && isValidZoneId(zoneId));

  const servedZoneId = useRef<string | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!active) return;
    if (servedZoneId.current === zoneId) return;
    servedZoneId.current = zoneId;

    window.AdProvider = window.AdProvider || [];
    window.AdProvider.push({ serve: {} });
  }, [active, zoneId]);

  useEffect(() => {
    if (!active) return;

    const checkFilled = () => {
      const root = rootRef.current;
      if (!root) return false;
      const iframe = root.querySelector("iframe");
      if (iframe && (iframe.offsetHeight > 20 || iframe.offsetWidth > 20)) return true;
      // Some creatives inject a sized div instead of (or before) iframe.
      const kids = root.querySelectorAll("ins > *");
      for (const kid of kids) {
        const el = kid as HTMLElement;
        if (el.offsetHeight > 20 && el.offsetWidth > 20) return true;
      }
      return false;
    };

    // Show once filled; if still empty after retries, remove the shell entirely.
    const timers = [1200, 2500, 4500].map((ms) =>
      window.setTimeout(() => {
        if (checkFilled()) {
          setVisible(true);
        } else if (ms >= 4500) {
          setVisible(false);
        }
      }, ms),
    );

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [active, zoneId]);

  if (!active || !visible) return null;

  return (
    <aside
      ref={rootRef}
      aria-label="Advertisement"
      className={`flex min-h-0 justify-center overflow-hidden empty:hidden ${className}`}
    >
      <ins className={resolveInsClass(zone, network)} data-zoneid={zoneId} />
    </aside>
  );
}
