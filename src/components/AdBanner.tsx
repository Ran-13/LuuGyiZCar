import type { AdBannerConfig } from "@/lib/ads-types";

interface AdBannerProps {
  banner: AdBannerConfig | null | undefined;
  className?: string;
}

/** Renders a GIF/image ad when the slot is enabled and has an image. */
export default function AdBanner({ banner, className = "" }: AdBannerProps) {
  if (!banner?.enabled || !banner.imageUrl) return null;

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- GIF ads + arbitrary upload URLs
    <img
      src={banner.imageUrl}
      alt={banner.alt || "Advertisement"}
      className="mx-auto max-h-40 w-full object-contain sm:max-h-48"
      loading="lazy"
      decoding="async"
    />
  );

  return (
    <aside
      aria-label="Advertisement"
      className={`overflow-hidden rounded-lg border border-ink-700 bg-ink-900 ${className}`}
    >
      {banner.linkUrl ? (
        <a
          href={banner.linkUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block p-1.5 transition-opacity hover:opacity-90"
        >
          {image}
        </a>
      ) : (
        <div className="p-1.5">{image}</div>
      )}
    </aside>
  );
}
