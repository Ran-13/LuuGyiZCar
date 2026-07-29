"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { AdNetworkConfig } from "@/lib/ads-types";
import { EXOCLICK_INS_CLASS, isValidZoneId } from "@/lib/ads-types";
import { STORAGE_KEYS } from "@/lib/storage-keys";

const SLOT = "net-video-interstitial" as const;

/**
 * localStorage is an external store, so the cooldown is read through
 * useSyncExternalStore rather than useEffect + setState — the latter is
 * rejected by `react-hooks/set-state-in-effect` and would also render the
 * overlay for one frame before hiding it.
 *
 * KNOWN LIMITATION: this fires on client-side navigation (clicking a video
 * card) but NOT on a direct page load of /video/<id> — a shared or search-engine
 * link. On that path React hydrates using getServerSnapshot, which is always
 * false because the server cannot know a visitor's cooldown, and the tag never
 * appears. Notifying once after mount (below) was expected to fix it and
 * verifiably does not; the cause is not yet identified. Card clicks are the
 * dominant path, so this ships gated to that until the direct-load case is
 * understood — do not assume it works there.
 */
const subscribe = (onStoreChange: () => void) => {
  const id = setTimeout(onStoreChange, 0);
  return () => clearTimeout(id);
};

function readLastShown(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.interstitialShownAt);
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    // Private mode / storage disabled — treat as never shown.
    return 0;
  }
}

interface Props {
  network: AdNetworkConfig;
}

/**
 * Full-page ExoClick interstitial shown when a video page opens.
 *
 * Video cards navigate with <Link>, so arriving here is a client-side route
 * change, not a page load. This component mounting is what triggers delivery —
 * the same mechanism ExoClickZone relies on.
 */
export default function ExoClickInterstitial({ network }: Props) {
  const zone = network?.zones?.[SLOT];
  const zoneId = zone?.zoneId ?? "";
  const configured = Boolean(network?.enabled && zone?.enabled && isValidZoneId(zoneId));

  const cooldownMs = Math.max(0, network?.interstitialCooldownMinutes ?? 0) * 60_000;

  // Returns a boolean — a primitive, so Object.is keeps the snapshot stable and
  // there is no render loop despite reading Date.now().
  const getSnapshot = useCallback(() => {
    if (!configured) return false;
    if (cooldownMs === 0) return true;
    return Date.now() - readLastShown() >= cooldownMs;
  }, [configured, cooldownMs]);

  // The server cannot know the visitor's cooldown, so it never renders the tag.
  const getServerSnapshot = useCallback(() => false, []);

  const allowed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const servedZoneId = useRef<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    if (servedZoneId.current === zoneId) return;
    servedZoneId.current = zoneId;

    // Stamping the time is a side effect on an external store, which is what
    // useEffect is for — the same shape as WatchHistoryRecorder.
    try {
      localStorage.setItem(STORAGE_KEYS.interstitialShownAt, String(Date.now()));
    } catch {
      // Non-fatal: the interstitial simply is not rate-limited on this device.
    }

    window.AdProvider = window.AdProvider || [];
    window.AdProvider.push({ serve: {} });
  }, [allowed, zoneId]);

  if (!allowed) return null;

  // No wrapper styling: ExoClick positions the fullpage creative itself.
  return <ins className={network.insClass || EXOCLICK_INS_CLASS} data-zoneid={zoneId} />;
}
