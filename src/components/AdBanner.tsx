import type { AdBannerConfig } from "@/lib/ads-types";

interface AdBannerProps {
  banner: AdBannerConfig | null | undefined;
  className?: string;
  /** Stick to the bottom of the viewport (outside scroll flow). */
  sticky?: boolean;
  /** Load eagerly (above-the-fold banners). Default true. */
  priority?: boolean;
}

/** Renders a GIF/image ad when the slot is enabled and has an image. */
export default function AdBanner({
  banner,
  className = "",
  sticky = false,
  priority = true,
}: AdBannerProps) {
  if (!banner?.enabled || !banner.imageUrl) return null;

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- GIF ads + arbitrary upload URLs
    <img
      src={banner.imageUrl}
      alt={banner.alt || "Advertisement"}
      className="w-full object-fill sm:max-h-28"
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
    />
  );

  const stickyClasses = sticky
    ? "fixed bottom-0 left-0 right-0 z-50"
    : "";

  return (
    <aside
      aria-label="Advertisement"
      className={`overflow-hidden ${stickyClasses} ${className}`}
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
