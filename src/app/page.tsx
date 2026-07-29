import Link from "next/link";
import AdBanner from "@/components/AdBanner";
import AnnouncementDialog from "@/components/AnnouncementDialog";
import EmptyState from "@/components/EmptyState";
import ExoClickZone from "@/components/ExoClickZone";
import HomeAnnouncement from "@/components/HomeAnnouncement";
import InfiniteVideoGrid from "@/components/InfiniteVideoGrid";
import SectionHeading from "@/components/SectionHeading";
import { readAdsConfig } from "@/lib/ads";
import { CATEGORIES } from "@/lib/categories";
import { searchVideos } from "@/lib/eporner";

export const revalidate = 60;

/** Videos fetched per infinite-scroll batch. */
const BATCH_SIZE = 24;

/** Empty query = the whole catalog, which is what "trending" should draw from. */
const FEED_QUERY = "";

const FEED_ORDER = "top-weekly" as const;

export default async function HomePage() {
  const [trending, ads] = await Promise.all([
    searchVideos({
      query: FEED_QUERY,
      perPage: BATCH_SIZE,
      order: FEED_ORDER,
    }),
    readAdsConfig(),
  ]);

  return (
    <>
      <AnnouncementDialog announcement={ads.announcement} />

      {/* The header carries the same rail on lg+, so this is the mobile affordance. */}
      <nav
        aria-label="Browse categories"
        className="no-scrollbar -mx-3 mb-6 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0 lg:hidden"
      >
        {CATEGORIES.map((cat) => (
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

      <SectionHeading as="h1" title="Trending Now" subtitle="Most watched this week" />

      {trending.failed ? (
        <EmptyState
          title="Could not reach the video service"
          message="The upstream API did not respond. Try refreshing in a moment."
        />
      ) : (
        <InfiniteVideoGrid
          initialVideos={trending.videos}
          totalPages={trending.totalPages}
          query={FEED_QUERY}
          order={FEED_ORDER}
          batchSize={BATCH_SIZE}
          priorityCount={6}
        />
      )}

      <ExoClickZone network={ads.network} slot="net-home-bottom" className="mt-8" />

      {/* Spacer so fixed bottom banner doesn't overlap content */}
      {ads.banners["home-bottom"]?.enabled && <div className="h-20" />}
      <AdBanner banner={ads.banners["home-bottom"]} sticky />
    </>
  );
}
