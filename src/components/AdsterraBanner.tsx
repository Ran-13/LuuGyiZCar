"use client";

import { useEffect, useId, useRef } from "react";
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
  const reactId = useId();

  useEffect(() => {
    if (!active || !unit || !iframeRef.current) return;
    const host = unit.invokeHost || DEFAULT_INVOKE_HOST;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head><body>
<script>atOptions={key:${JSON.stringify(unit.key)},format:"iframe",height:${unit.height},width:${unit.width},params:{}};</script>
<script src="https://${host}/${unit.key}/invoke.js"><\/script>
</body></html>`;
    iframeRef.current.srcdoc = html;
  }, [active, unit, reactId]);

  if (!active || !unit) return null;

  return (
    <aside
      aria-label="Advertisement"
      className={`flex justify-center overflow-hidden ${className}`}
    >
      <iframe
        ref={iframeRef}
        title={`Adsterra ${slot}`}
        width={unit.width}
        height={unit.height}
        style={{ border: 0, maxWidth: "100%", overflow: "hidden" }}
        scrolling="no"
        loading="lazy"
      />
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
