"use client";

import { useEffect, useRef } from "react";
import type { AdNetworkConfig } from "@/lib/ads-types";
import { isValidZoneId } from "@/lib/ads-types";

/** ExoClick remote popunder script (same CDN family as their other tags). */
const POPUNDER_SCRIPT = "https://a.pemsrv.com/popunder1000.js";

/**
 * Class on video cards — popunder fires only when these links are clicked,
 * not on every header/category tap.
 */
export const POPUNDER_TRIGGER_CLASS = "exo-int-trigger";

/**
 * ExoClick Popunder.
 *
 * Remote snippet style (from ExoClick dashboard):
 *
 *   <script>
 *     var ad_idzone = "…",
 *     ad_trigger_method = 2,
 *     ad_trigger_class = "exo-int-trigger",
 *     …;
 *   </script>
 *   <script src="https://a.pemsrv.com/popunder1000.js"></script>
 *
 * Trigger method 2 = "Clicking on a specific class" so only video cards
 * (class exo-int-trigger) open a popunder. Frequency/capping is set in the
 * ExoClick zone panel.
 */
export default function ExoClickPopunder({ network }: { network: AdNetworkConfig }) {
  const injected = useRef(false);

  const zoneId = network?.popunderZoneId ?? "";
  const active = Boolean(
    network?.enabled && network?.popunderEnabled && isValidZoneId(zoneId),
  );

  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    if (injected.current) return;
    if (document.getElementById("exo-popunder-script")) {
      injected.current = true;
      return;
    }
    injected.current = true;

    // Globals must exist before popunder1000.js runs.
    const config = document.createElement("script");
    config.id = "exo-popunder-config";
    config.type = "application/javascript";
    config.text = [
      `var ad_idzone = ${JSON.stringify(zoneId)};`,
      "var ad_popup_fallback = false;",
      "var ad_popup_force = false;",
      "var ad_chrome_enabled = true;",
      "var ad_new_tab = false;",
      // 2 = specific CSS class (video cards only).
      "var ad_trigger_method = 2;",
      `var ad_trigger_class = ${JSON.stringify(POPUNDER_TRIGGER_CLASS)};`,
      "var ad_trigger_delay = 0;",
    ].join("\n");
    document.body.appendChild(config);

    const script = document.createElement("script");
    script.id = "exo-popunder-script";
    script.type = "application/javascript";
    script.async = true;
    script.src = POPUNDER_SCRIPT;
    document.body.appendChild(script);

    // Intentionally not removed on unmount — popunder must stay armed for the
    // whole session; tearing it down on soft-nav would break the next click.
  }, [active, zoneId]);

  return null;
}
