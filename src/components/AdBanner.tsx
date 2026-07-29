"use client";

import { useState } from "react";
import type { AdBannerConfig } from "@/lib/ads-types";

interface AdBannerProps {
  banner: AdBannerConfig | null | undefined;
  className?: string;
  /** Stick to the bottom of the viewport (outside scroll flow). */
  sticky?: boolean;
  /** Load eagerly (above-the-fold banners). Default true. */
  priority?: boolean;
}

/**
 * Renders a GIF/image ad when the slot is enabled and has an image.
 *
 * Hidden until the image loads successfully — avoids Safari's broken-image "?"
 * icons and the visible "Advertisement" alt text when the GIF 404s or is blocked.
 */
export default function AdBanner({
  banner,
  className = "",
  sticky = false,
  priority = true,
}: AdBannerProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  if (!banner?.enabled || !banner.imageUrl || status === "error") return null;

  const stickyClasses = sticky ? "fixed bottom-0 left-0 right-0 z-50" : "";
  // Keep in DOM while loading (so the request runs) but take no layout space.
  const hideShell = status === "loading";

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- GIF ads + arbitrary upload URLs
    <img
      src={banner.imageUrl}
      alt=""
      className="w-full object-fill sm:max-h-28"
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      onLoad={() => setStatus("ready")}
      onError={() => setStatus("error")}
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
