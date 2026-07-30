"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
 * ExoClick Fullpage Interstitial.
 *
 * Re-arms on every listing visit (including Safari Back / bfcache). A one-shot
 * serve left the click handler dead after the first video click.
 *
 * Frequency still also obeys the ExoClick zone Capping setting (e.g. 1×24h).
 * If ads never return within a session after this fix, lower Capping in the
 * ExoClick dashboard (e.g. every click / every few minutes).
 */
export default function ExoClickInterstitial({ network }: { network: AdNetworkConfig }) {
  const pathname = usePathname();
  // Bump on pageshow(persisted) so <ins> nodes are recreated after Back.
  const [visit, setVisit] = useState(0);

  const active = INTERSTITIAL_SLOTS.filter((slot) => {
    const zone = network?.zones?.[slot];
    return Boolean(network?.enabled && zone?.enabled && isValidZoneId(zone.zoneId));
  });

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      // Browser restored this page from bfcache — React effects may not re-run.
      if (event.persisted) {
        setVisit((v) => v + 1);
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // Re-serve whenever the listing route, visit counter, or zone config changes.
  useEffect(() => {
    if (active.length === 0) return;

    queueAdServe();
    const t1 = window.setTimeout(queueAdServe, 400);
    const t2 = window.setTimeout(queueAdServe, 1200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [pathname, visit, active.length, network.enabled]);

  if (active.length === 0) return null;

  return (
    <>
      {active.map((slot) => {
        const zone = network.zones[slot];
        return (
          <ins
            // Fresh node each visit so AdProvider re-binds the click interceptor.
            key={`${slot}-${pathname}-${visit}-${zone.zoneId}`}
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
