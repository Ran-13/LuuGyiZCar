import { Suspense } from "react";
import Link from "next/link";
import AdBanner from "@/components/AdBanner";
import AdsterraBanner from "@/components/AdsterraBanner";
import AnnouncementDialog from "@/components/AnnouncementDialog";
import EmptyState from "@/components/EmptyState";
import ExoClickInterstitial from "@/components/ExoClickInterstitial";
import ExoClickZone from "@/components/ExoClickZone";
import GridSkeleton from "@/components/GridSkeleton";
import HomeAnnouncement from "@/components/HomeAnnouncement";
import InfiniteVideoGrid from "@/components/InfiniteVideoGrid";
import SectionHeading from "@/components/SectionHeading";
import VipVideosSection from "@/components/VipVideosSection";
import { readAdsConfig } from "@/lib/ads";
import {
  isSortOrder,
  DEFAULT_ORDER,
  searchVideos,
  type SortOrder,
} from "@/lib/eporner";
import type { Category } from "@/lib/categories";

export const revalidate = 60;

/** Videos fetched per infinite-scroll batch. */
const BATCH_SIZE = 24;

async function TrendingFeed({
  query,
  order,
  categories,
  columns,
}: {
  query: string;
  order: SortOrder;
  categories: Category[];
  columns: 1 | 2;
}) {
  const trending = await searchVideos({
    query,
    perPage: BATCH_SIZE,
    order,
  });

  if (trending.failed) {
    return (
      <EmptyState
        title="Could not reach the video service"
        message="The upstream API did not respond. Try refreshing in a moment."
      />
    );
  }

  return (
    <InfiniteVideoGrid
      initialVideos={trending.videos}
      totalPages={trending.totalPages}
      query={query}
      order={order}
      batchSize={BATCH_SIZE}
      priorityCount={4}
      categories={categories}
      columns={columns}
    />
  );
}

export default async function HomePage() {
  const ads = await readAdsConfig();
  const feed = ads.feed;
  const homeOrder = isSortOrder(feed.homeOrder) ? feed.homeOrder : DEFAULT_ORDER;
  const homeQuery = feed.homeQuery;
  const gridColumns = feed.gridColumns === 1 ? 1 : 2;

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

      <AdBanner banner={ads.banners["home-top"]} className="mb-6" priority />

      <ExoClickZone network={ads.network} slot="net-home-top" className="mb-6" />
      <AdsterraBanner adsterra={ads.adsterra} slot="ads-home-top" className="mb-6" />

      <VipVideosSection
        vip={ads.vipVideos}
        adsterra={ads.adsterra}
        customBanner={ads.banners["vip-below"]}
      />

      <SectionHeading as="h1" title={feed.homeTitle} subtitle={feed.homeSubtitle} />

      <Suspense fallback={<GridSkeleton count={BATCH_SIZE} columns={gridColumns} />}>
        <TrendingFeed
          query={homeQuery}
          order={homeOrder}
          categories={feed.categories}
          columns={gridColumns}
        />
      </Suspense>

      <ExoClickZone network={ads.network} slot="net-home-bottom" className="mt-8" />
      <AdsterraBanner adsterra={ads.adsterra} slot="ads-home-bottom" className="mt-8" />
    </>
  );
}
