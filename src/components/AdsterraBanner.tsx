"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AdsterraBannerUnit, AdsterraConfig } from "@/lib/ads-types";
import type { AdsterraBannerSlotId } from "@/lib/ads-types";

const DEFAULT_INVOKE_HOST = "www.highperformanceformat.com";

/**
 * Adsterra display banner via iframe srcdoc so multiple units don't fight over
 * the global `atOptions` variable (common Adsterra + React pitfall).
 */
export default function AdsterraBanner({
  adsterra,
  slot,
  className = "",
}: {
  adsterra: AdsterraConfig;
  slot: AdsterraBannerSlotId;
  className?: string;
}) {
  const unit = adsterra?.banners?.[slot];
  const active = Boolean(adsterra?.enabled && unit?.enabled && unit.key);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const shellRef = useRef<HTMLElement | null>(null);
  const reactId = useId();
  const aboveFold = slot === "ads-home-top";
  const [shouldLoad, setShouldLoad] = useState(aboveFold);

  useEffect(() => {
    if (!active || aboveFold) return;
    const el = shellRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldLoad(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [active, aboveFold]);

  useEffect(() => {
    if (!active || !shouldLoad || !unit || !iframeRef.current) return;
    const host = unit.invokeHost || DEFAULT_INVOKE_HOST;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head><body>
<script>atOptions={key:${JSON.stringify(unit.key)},format:"iframe",height:${unit.height},width:${unit.width},params:{}};</script>
<script src="https://${host}/${unit.key}/invoke.js"><\/script>
</body></html>`;
    iframeRef.current.srcdoc = html;
  }, [active, shouldLoad, unit, reactId]);

  if (!active || !unit) return null;

  return (
    <aside
      ref={shellRef}
      aria-label="Advertisement"
      className={`flex justify-center overflow-hidden ${className}`}
      style={{ minHeight: unit.height }}
    >
      {shouldLoad ? (
        <iframe
          ref={iframeRef}
          title={`Adsterra ${slot}`}
          width={unit.width}
          height={unit.height}
          style={{ border: 0, maxWidth: "100%", overflow: "hidden" }}
          scrolling="no"
          loading={aboveFold ? "eager" : "lazy"}
        />
      ) : null}
    </aside>
  );
}

export function isAdsterraBannerActive(
  adsterra: AdsterraConfig | null | undefined,
  slot: AdsterraBannerSlotId,
): boolean {
  const unit: AdsterraBannerUnit | undefined = adsterra?.banners?.[slot];
  return Boolean(adsterra?.enabled && unit?.enabled && unit.key);
}
