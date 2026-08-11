import Link from "next/link";
import AdBanner from "@/components/AdBanner";
import AdsterraBanner from "@/components/AdsterraBanner";
import AnnouncementDialog from "@/components/AnnouncementDialog";
import EmptyState from "@/components/EmptyState";
import ExoClickInterstitial from "@/components/ExoClickInterstitial";
import ExoClickZone from "@/components/ExoClickZone";
import HomeAnnouncement from "@/components/HomeAnnouncement";
import InfiniteVideoGrid from "@/components/InfiniteVideoGrid";
import SectionHeading from "@/components/SectionHeading";
import { readAdsConfig } from "@/lib/ads";
import { isSortOrder, DEFAULT_ORDER, searchVideos } from "@/lib/eporner";

export const revalidate = 60;

/** Videos fetched per infinite-scroll batch. */
const BATCH_SIZE = 24;

export default async function HomePage() {
  const ads = await readAdsConfig();
  const feed = ads.feed;
  const homeOrder = isSortOrder(feed.homeOrder) ? feed.homeOrder : DEFAULT_ORDER;
  const homeQuery = feed.homeQuery;

  const trending = await searchVideos({
    query: homeQuery,
    perPage: BATCH_SIZE,
    order: homeOrder,
  });

  return (
    <>
      <AnnouncementDialog announcement={ads.announcement} />

      {/* Fires on video-card clicks from this grid — the "Clicking on Links" trigger. */}
      <ExoClickInterstitial network={ads.network} />

      {/* The header carries the same rail on lg+, so this is the mobile affordance. */}
      <nav
        aria-label="Browse categories"
        className="no-scrollbar -mx-3 mb-6 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0 lg:hidden"
      >
        {feed.categories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/category/${cat.slug}`}
            className="shrink-0 rounded-md border border-ink-700 bg-ink-850 px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap text-ink-300 transition-colors hover:border-brand-500 hover:text-brand-500"
          >
            {cat.label}
          </Link>
        ))}
      </nav>

      <HomeAnnouncement announcement={ads.announcement} />

      <AdBanner banner={ads.banners["home-top"]} className="mb-6" />

      <ExoClickZone network={ads.network} slot="net-home-top" className="mb-6" />
      <AdsterraBanner adsterra={ads.adsterra} slot="ads-home-top" className="mb-6" />

      <SectionHeading as="h1" title={feed.homeTitle} subtitle={feed.homeSubtitle} />

      {trending.failed ? (
        <EmptyState
          title="Could not reach the video service"
          message="The upstream API did not respond. Try refreshing in a moment."
        />
      ) : (
        <InfiniteVideoGrid
          initialVideos={trending.videos}
          totalPages={trending.totalPages}
          query={homeQuery}
          order={homeOrder}
          batchSize={BATCH_SIZE}
          priorityCount={6}
          categories={feed.categories}
        />
      )}

      <ExoClickZone network={ads.network} slot="net-home-bottom" className="mt-8" />
      <AdsterraBanner adsterra={ads.adsterra} slot="ads-home-bottom" className="mt-8" />
    </>
  );
}
