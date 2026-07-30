"use client";

import { useEffect, useRef, useState } from "react";
import type { AdBannerConfig } from "@/lib/ads-types";

interface AdBannerProps {
  banner: AdBannerConfig | null | undefined;
  className?: string;
  /** Stick to the bottom of the viewport (outside scroll flow). */
  sticky?: boolean;
  /** Load eagerly (above-the-fold banners). Default true. */
  priority?: boolean;
}

/** Total load attempts before the slot is treated as unavailable. */
const MAX_ATTEMPTS = 4;

/** Backoff before attempts 2, 3 and 4. Short first — most failures are transient. */
const RETRY_DELAYS_MS = [500, 1500, 4000];

/**
 * Renders a GIF/image ad when the slot is enabled and has an image.
 *
 * Retries on failure rather than hiding permanently. A single transient miss —
 * a dropped request on a slow mobile connection, a CDN hiccup — used to blank
 * the slot for the whole page view, which looked like ads "disappearing" and
 * then coming back on navigation (a remount reset the state).
 *
 * Stays hidden until an image actually decodes, so a failing slot never shows
 * Safari's broken-image icon or leaves an empty reserved gap.
 */
export default function AdBanner({
  banner,
  className = "",
  sticky = false,
  priority = true,
}: AdBannerProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const imageUrl = banner?.imageUrl ?? "";

  const handleFailure = () => {
    const next = attempt + 1;
    if (next >= MAX_ATTEMPTS) {
      setStatus("failed");
      return;
    }
    // setState inside a timer callback, not in an effect body — the pattern the
    // set-state-in-effect rule permits.
    retryTimer.current = setTimeout(
      () => {
        setStatus("loading");
        setAttempt(next);
      },
      RETRY_DELAYS_MS[attempt] ?? 4000,
    );
  };

  /**
   * Reconcile with the DOM after mount.
   *
   * On a server-rendered page the browser starts (and often finishes) this
   * request while parsing the HTML, before hydration attaches React's onLoad /
   * onError. Those events then never fire, `status` stays "loading" forever and
   * the banner is hidden permanently — which is what made ads vanish on refresh
   * yet reappear on client-side navigation, where React creates the element and
   * does observe the events. Reading `complete`/`naturalWidth` recovers the
   * outcome React missed.
   */
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    // Deferred so the setState happens in a callback, not the effect body.
    const frame = requestAnimationFrame(() => {
      if (!img.complete) return;
      if (img.naturalWidth > 0) setStatus("ready");
      else handleFailure();
    });

    return () => cancelAnimationFrame(frame);
    // handleFailure is recreated each render but only reads `attempt`, which is
    // already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  if (!banner?.enabled || !imageUrl || status === "failed") return null;

  // Only retries get a cache-buster, so the first request can still be served
  // from the browser or nginx cache.
  const src = attempt === 0 ? imageUrl : `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}r=${attempt}`;

  const stickyClasses = sticky ? "fixed bottom-0 left-0 right-0 z-50" : "";
  // Kept in the DOM while loading so the request runs, but taking no layout space.
  const hideShell = status !== "ready";

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- GIF ads + arbitrary upload URLs
    <img
      // Remounts the element on retry, which is what forces a fresh request.
      key={attempt}
      ref={imgRef}
      src={src}
      alt=""
      className="w-full object-fill sm:max-h-28"
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      onLoad={() => setStatus("ready")}
      onError={handleFailure}
    />
  );

  return (
    <aside
      aria-label="Advertisement"
      aria-hidden={hideShell}
      className={`overflow-hidden ${stickyClasses} ${className} ${
        hideShell ? "pointer-events-none absolute h-0 w-0 opacity-0" : ""
      }`}
    >
      {banner.linkUrl ? (
        <a
          href={banner.linkUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block h-full transition-opacity hover:opacity-90"
        >
          {image}
        </a>
      ) : (
        <div className="h-full">{image}</div>
      )}
    </aside>
  );
}
