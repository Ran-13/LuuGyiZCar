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
      <AdBanner banner={customBanner} className="mb-6" priority />

      {vip.sectionTitle.trim() ? (
        <SectionHeading title={vip.sectionTitle.trim()} />
      ) : null}

      <div className="space-y-8">
        {items.map((item) => (
          <article key={item.id} className="overflow-hidden">
            {item.imageUrl ? (
              <div className="overflow-hidden bg-ink-900">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded promo art */}
                <img
                  src={item.imageUrl}
                  alt={item.title || "VIP video"}
                  className="mx-auto block h-auto max-h-[70vh] w-full object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ) : null}

            {(item.title || item.description) && (
              <div className="mt-4">
                {item.title ? (
                  <h3 className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-ink-100 sm:text-xl">
                    <span className="h-5 w-1 shrink-0 rounded-full bg-brand-500" aria-hidden />
                    <span className="truncate">{item.title}</span>
                  </h3>
                ) : null}
                {item.description ? (
                  <p className="mt-1 whitespace-pre-line pl-3.5 text-xs text-ink-400 sm:text-sm">
                    {item.description}
                  </p>
                ) : null}
              </div>
            )}

            {(item.channelLink || item.postLink) && (
              <div className="mt-3 flex flex-wrap gap-2 pl-3.5">
                {item.channelLink ? (
                  <a
                    href={item.channelLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-ink-700 bg-ink-850 px-3.5 py-1.5 text-[13px] font-semibold text-ink-200 transition-colors hover:border-brand-500 hover:text-brand-500"
                  >
                    Channel
                  </a>
                ) : null}
                {item.postLink ? (
                  <a
                    href={item.postLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-brand-500/40 bg-brand-500/10 px-3.5 py-1.5 text-[13px] font-semibold text-brand-500 transition-colors hover:bg-brand-500/20"
                  >
                    Watch post
                  </a>
                ) : null}
              </div>
            )}
          </article>
        ))}
      </div>

      <AdsterraBanner adsterra={adsterra} slot="ads-vip-below" className="mt-6" />
    </section>
  );
}
