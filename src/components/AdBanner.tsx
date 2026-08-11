"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AdBannerConfig } from "@/lib/ads-types";
import { isAdminUiPath } from "@/lib/admin-path";

interface AdBannerProps {
  banner: AdBannerConfig | null | undefined;
  className?: string;
  /** Stick to the bottom of the viewport (outside scroll flow). */
  sticky?: boolean;
  /** Eager + high fetch priority — only for the true above-the-fold banner. */
  priority?: boolean;
}

/** Total load attempts before the slot is treated as unavailable. */
const MAX_ATTEMPTS = 4;

/** Backoff before attempts 2, 3 and 4. Short first — most failures are transient. */
const RETRY_DELAYS_MS = [500, 1500, 4000];

/**
 * Renders a GIF/image ad when the slot is enabled and has an image.
 *
 * Sticky mode portals to document.body with position:fixed so the bar stays
 * above the scroll on every page (home + video details), never in the flow.
 */
export default function AdBanner({
  banner,
  className = "",
  sticky = false,
  priority = false,
}: AdBannerProps) {
  const pathname = usePathname();
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const [mounted, setMounted] = useState(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const imageUrl = banner?.imageUrl ?? "";
  const hideOnAdmin = sticky && isAdminUiPath(pathname);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleFailure = () => {
    const next = attempt + 1;
    if (next >= MAX_ATTEMPTS) {
      setStatus("failed");
      return;
    }
    retryTimer.current = setTimeout(
      () => {
        setStatus("loading");
        setAttempt(next);
      },
      RETRY_DELAYS_MS[attempt] ?? 4000,
    );
  };

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const frame = requestAnimationFrame(() => {
      if (!img.complete) return;
      if (img.naturalWidth > 0) setStatus("ready");
      else handleFailure();
    });

    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  // Keep content clear of the fixed bar sitewide.
  useEffect(() => {
    if (!sticky || !mounted || hideOnAdmin || !banner?.enabled || !imageUrl || status !== "ready") {
      return;
    }
    const prev = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "5rem";
    return () => {
      document.body.style.paddingBottom = prev;
    };
  }, [sticky, mounted, hideOnAdmin, banner?.enabled, imageUrl, status]);

  if (!banner?.enabled || !imageUrl || status === "failed" || hideOnAdmin) return null;

  const src = attempt === 0 ? imageUrl : `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}r=${attempt}`;
  const hideShell = status !== "ready";
  // Sticky bars must never compete with LCP thumbs / the player poster.
  const eager = priority && !sticky;

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- GIF ads + arbitrary upload URLs
    <img
      key={attempt}
      ref={imgRef}
      src={src}
      alt=""
      className="w-full object-fill sm:max-h-28"
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : "low"}
      onLoad={() => setStatus("ready")}
      onError={handleFailure}
    />
  );

  const inner = banner.linkUrl ? (
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
  );

  if (sticky) {
    if (!mounted) return null;
    const shell = (
      <aside
        aria-label="Advertisement"
        aria-hidden={hideShell}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
        }}
        className={`overflow-hidden ${className} ${
          hideShell ? "pointer-events-none h-0 opacity-0" : ""
        }`}
      >
        {inner}
      </aside>
    );
    return createPortal(shell, document.body);
  }

  return (
    <aside
      aria-label="Advertisement"
      aria-hidden={hideShell}
      className={`min-h-[4.5rem] overflow-hidden sm:min-h-[7rem] ${className} ${
        hideShell ? "pointer-events-none opacity-0" : ""
      }`}
    >
      {inner}
    </aside>
  );
}
