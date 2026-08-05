"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AdNetworkConfig, NetworkSlotId } from "@/lib/ads-types";
import {
  STICKY_BOTTOM_SLOTS,
  STICKY_TOP_SLOTS,
  isValidZoneId,
  resolveInsClass,
} from "@/lib/ads-types";
import { isAdminUiPath } from "@/lib/admin-path";

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

function activeSlots(
  network: AdNetworkConfig,
  slots: readonly NetworkSlotId[],
): NetworkSlotId[] {
  return slots.filter((slot) => {
    const zone = network?.zones?.[slot];
    return Boolean(network?.enabled && zone?.enabled && isValidZoneId(zone.zoneId));
  });
}

/**
 * Viewport-fixed rail. Portaled to document.body so no parent transform /
 * overflow can pull it into the scroll flow.
 */
function StickyRail({
  network,
  slots,
  pathname,
  position,
}: {
  network: AdNetworkConfig;
  slots: NetworkSlotId[];
  pathname: string;
  position: "top" | "bottom";
}) {
  if (slots.length === 0) return null;

  const style: React.CSSProperties =
    position === "top"
      ? {
          position: "fixed",
          top: "3.5rem",
          left: 0,
          right: 0,
          zIndex: 45,
          pointerEvents: "none",
        }
      : {
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 45,
          pointerEvents: "none",
        };

  return (
    <aside aria-label="Advertisement" style={style} className="flex justify-center">
      <div
        className={`pointer-events-auto flex w-full max-w-lg flex-col overflow-hidden sm:max-w-xl ${
          position === "bottom" ? "flex-col-reverse" : ""
        }`}
      >
        {slots.map((slot) => {
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

/**
 * ExoClick Sticky Banners — fixed to the viewport on every public page
 * (home, listings, video details). Not part of document scroll.
 */
export default function ExoClickStickyBanner({ network }: { network: AdNetworkConfig }) {
  const pathname = usePathname();
  const servedKey = useRef<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const top = activeSlots(network, STICKY_TOP_SLOTS);
  const bottom = activeSlots(network, STICKY_BOTTOM_SLOTS);
  const active = [...top, ...bottom];

  const key = active
    .map((slot) => {
      const z = network.zones[slot];
      return `${slot}:${z.zoneId}:${resolveInsClass(z, network)}`;
    })
    .join("|");

  useEffect(() => {
    if (!key || isAdminUiPath(pathname)) return;
    servedKey.current = key;
    queueAdServe();
    const t = window.setTimeout(queueAdServe, 600);
    return () => window.clearTimeout(t);
  }, [key, pathname]);

  // Reserve space so the last grid cards / video meta aren't hidden under the bar.
  useEffect(() => {
    if (!mounted || isAdminUiPath(pathname) || bottom.length === 0) {
      document.body.style.removeProperty("padding-bottom");
      return;
    }
    document.body.style.paddingBottom = bottom.length > 1 ? "7.5rem" : "4.5rem";
    return () => {
      document.body.style.removeProperty("padding-bottom");
    };
  }, [mounted, pathname, bottom.length]);

  if (!mounted || active.length === 0 || isAdminUiPath(pathname)) return null;

  return createPortal(
    <>
      <StickyRail network={network} slots={top} pathname={pathname} position="top" />
      <StickyRail network={network} slots={bottom} pathname={pathname} position="bottom" />
    </>,
    document.body,
  );
}
