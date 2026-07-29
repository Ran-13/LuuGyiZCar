"use client";

import { useEffect, useRef } from "react";
import type { AdNetworkConfig, NetworkSlotId } from "@/lib/ads-types";
import { INTERSTITIAL_SLOTS, isValidZoneId } from "@/lib/ads-types";

/** Official ExoClick Fullpage Interstitial script (not ad-provider.js). */
const FP_SCRIPT_SRC = "https://a.exosrv.com/fp-interstitial.js";

function activeInterstitialSlots(network: AdNetworkConfig): NetworkSlotId[] {
  return INTERSTITIAL_SLOTS.filter((slot) => {
    const zone = network?.zones?.[slot];
    return Boolean(network?.enabled && zone?.enabled && isValidZoneId(zone.zoneId));
  });
}

/**
 * ExoClick fullpage interstitial.
 *
 * This is a DIFFERENT product from banner zones:
 *   - Banners → ad-provider.js + <ins data-zoneid>
 *   - Interstitial → fp-interstitial.js + data-idzone on the <script> itself
 *
 * Belongs on LISTING pages (home, category, search). With the default trigger
 * ("Clicking on Links"), ExoClick intercepts <a> clicks, shows the ad, then
 * continues to the destination. Desktop and mobile are separate zone types —
 * both scripts may load; each only serves on its matching device.
 *
 * Frequency / capping is configured in the ExoClick zone, not here.
 */
export default function ExoClickInterstitial({ network }: { network: AdNetworkConfig }) {
  const active = activeInterstitialSlots(network);
  const loadedKey = useRef<string | null>(null);
  const key = active.map((slot) => `${slot}:${network.zones[slot].zoneId}`).join("|");

  useEffect(() => {
    if (!key || typeof document === "undefined") return;
    if (loadedKey.current === key) return;
    loadedKey.current = key;

    const slots = key.split("|").map((part) => {
      const [slot, zoneId] = part.split(":");
      return { slot, zoneId };
    });

    for (const { slot, zoneId } of slots) {
      if (!slot || !zoneId) continue;
      const scriptId = `exo-fp-interstitial-${slot}`;

      // Already injected (soft-nav back to a listing page) — skip.
      if (document.getElementById(scriptId)) continue;

      const script = document.createElement("script");
      script.id = scriptId;
      script.async = true;
      script.type = "application/javascript";
      script.src = FP_SCRIPT_SRC;
      // Zone id MUST live on the script tag — fp-interstitial.js reads
      // document.currentScript's data-idzone (NOT <ins data-zoneid>).
      script.setAttribute("data-idzone", zoneId);
      // No trigger attrs → defaults to "Clicking on Links" (all <a> tags).
      // Video cards also have class="exo-int-trigger" for publishers who choose
      // "specific class" in the ExoClick dashboard.
      document.body.appendChild(script);
    }
  }, [key]);

  // Scripts inject themselves into the DOM; nothing visible to render.
  return null;
}
