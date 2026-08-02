"use client";

import { useEffect, useRef } from "react";
import type { AdNetworkConfig } from "@/lib/ads-types";
import { isValidZoneId } from "@/lib/ads-types";

/**
 * Class on video cards — popunder fires only when these links are clicked,
 * not on every header/category tap.
 */
export const POPUNDER_TRIGGER_CLASS = "exo-int-trigger";

/**
 * ExoClick Popunder — injects the official v10 dashboard tag with the admin
 * zone id substituted. Trigger method 2 + class exo-int-trigger (video cards).
 *
 * Do not paste the ExoClick script into the page manually; Admin Zone ID +
 * Enable Popunder is enough.
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

    let cancelled = false;

    fetch("/vendor/exoclick-popunder-v10.js", { cache: "force-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(`popunder snippet ${res.status}`);
        return res.text();
      })
      .then((template) => {
        if (cancelled || document.getElementById("exo-popunder-script")) return;
        const script = document.createElement("script");
        script.id = "exo-popunder-script";
        script.type = "application/javascript";
        script.dataset.cfasync = "false";
        // Numeric idzone — matches ExoClick's generated tag (not a string).
        script.text = template.replaceAll("__IDZONE__", String(Number(zoneId)));
        document.body.appendChild(script);
      })
      .catch(() => {
        injected.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [active, zoneId]);

  return null;
}
