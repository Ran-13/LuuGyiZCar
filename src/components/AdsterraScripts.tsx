"use client";

import Script from "next/script";
import AdsterraBackGuard from "@/components/AdsterraBackGuard";
import type { AdsterraConfig } from "@/lib/ads-types";

/**
 * Adsterra Social Bar / Popunder scripts — same pattern as happyworldzone.com:
 * plain external <script src="https://pl….effectivecpmnetwork.com/….js"> tags.
 *
 * Popunder scripts also mount AdsterraBackGuard so Back still returns to this site.
 */
export default function AdsterraScripts({ adsterra }: { adsterra: AdsterraConfig }) {
  if (!adsterra?.enabled) return null;

  const active = adsterra.scripts.filter((s) => s.enabled && s.src);
  if (active.length === 0) return null;

  return (
    <>
      <AdsterraBackGuard enabled={adsterra.enabled} />
      {active.map((s) => (
        <Script
          key={s.id || s.src}
          id={`adsterra-${s.id}`}
          src={s.src}
          strategy="lazyOnload"
        />
      ))}
    </>
  );
}
