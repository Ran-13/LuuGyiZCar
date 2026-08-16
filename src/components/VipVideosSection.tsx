import AdBanner from "@/components/AdBanner";
import AdsterraBanner from "@/components/AdsterraBanner";
import SectionHeading from "@/components/SectionHeading";
import type { AdBannerConfig, AdsterraConfig, VipVideosConfig } from "@/lib/ads-types";

interface Props {
  vip: VipVideosConfig;
  adsterra: AdsterraConfig;
  customBanner: AdBannerConfig;
}

export default function VipVideosSection({ vip, adsterra, customBanner }: Props) {
  const items = (vip.items ?? []).filter((item) => item.enabled && (item.title || item.imageUrl));
  if (!vip.enabled || items.length === 0) return null;

  return (
    <section className="mb-8" aria-label={vip.sectionTitle || "VIP Videos"}>
      <AdBanner banner={customBanner} className="mb-5" priority />

      {vip.sectionTitle.trim() ? (
        <SectionHeading title={vip.sectionTitle.trim()} />
      ) : null}

      <div className="space-y-6">
        {items.map((item) => {
          const primaryHref = item.postLink || item.channelLink;
          const media = item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded promo art
            <img
              src={item.imageUrl}
              alt={item.title || "VIP video"}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-800 to-ink-950 text-sm font-medium text-ink-500">
              VIP
            </div>
          );

          return (
            <article
              key={item.id}
              className="overflow-hidden rounded-lg border border-ink-800 bg-ink-900/80 shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
            >
              {primaryHref ? (
                <a
                  href={primaryHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block aspect-[16/10] overflow-hidden bg-ink-950 sm:aspect-[21/9]"
                >
                  {media}
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  {item.title ? (
                    <span className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                      <span className="block text-base font-bold tracking-tight text-white sm:text-xl">
                        {item.title}
                      </span>
                      {item.description ? (
                        <span className="mt-1 line-clamp-2 block text-xs text-white/75 sm:text-sm">
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </a>
              ) : (
                <div className="relative aspect-[16/10] overflow-hidden bg-ink-950 sm:aspect-[21/9]">
                  {media}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  {item.title ? (
                    <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                      <h3 className="text-base font-bold tracking-tight text-white sm:text-xl">
                        {item.title}
                      </h3>
                      {item.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-white/75 sm:text-sm">
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}

              {(item.channelLink || item.postLink) && (
                <div className="grid grid-cols-2 gap-2 border-t border-ink-800 bg-ink-950/60 p-2.5 sm:p-3">
                  {item.channelLink ? (
                    <a
                      href={item.channelLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-ink-700 bg-ink-850 px-3 py-2.5 text-center text-[13px] font-semibold text-ink-100 transition-colors hover:border-brand-500 hover:text-brand-500"
                    >
                      Channel
                    </a>
                  ) : (
                    <span className="rounded-md border border-transparent px-3 py-2.5" />
                  )}
                  {item.postLink ? (
                    <a
                      href={item.postLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md bg-brand-500 px-3 py-2.5 text-center text-[13px] font-bold text-black transition-opacity hover:opacity-90"
                    >
                      Watch post
                    </a>
                  ) : (
                    <span className="rounded-md border border-transparent px-3 py-2.5" />
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <AdsterraBanner adsterra={adsterra} slot="ads-vip-below" className="mt-6" />
    </section>
  );
}
