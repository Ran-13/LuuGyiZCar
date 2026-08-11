"use client";

import Script from "next/script";
import type { AdsterraConfig } from "@/lib/ads-types";

/**
 * Adsterra Social Bar / Popunder scripts — same pattern as happyworldzone.com.
 *
 * Loaded afterInteractive (not lazy) so popunders attach before the first click.
 * No history.pushState / focus reclaim — those blocked or delayed popunders.
 */
export default function AdsterraScripts({ adsterra }: { adsterra: AdsterraConfig }) {
  if (!adsterra?.enabled) return null;

  const active = adsterra.scripts.filter((s) => s.enabled && s.src);
  if (active.length === 0) return null;

  return (
    <>
      {active.map((s) => (
        <Script
          key={s.id || s.src}
          id={`adsterra-${s.id}`}
          src={s.src}
          strategy="afterInteractive"
        />
      ))}
    </>
  );
}
