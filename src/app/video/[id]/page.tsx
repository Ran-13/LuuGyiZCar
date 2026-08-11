import { Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import AdBanner from "@/components/AdBanner";
import AdsterraBanner from "@/components/AdsterraBanner";
import ExoClickZone from "@/components/ExoClickZone";
import FavoriteButton from "@/components/FavoriteButton";
import GridSkeleton from "@/components/GridSkeleton";
import InfiniteVideoGrid from "@/components/InfiniteVideoGrid";
import SectionHeading from "@/components/SectionHeading";
import ShareButton from "@/components/ShareButton";
import VideoEmbed from "@/components/VideoEmbed";
import WatchHistoryRecorder from "@/components/WatchHistoryRecorder";
import { readAdsConfig } from "@/lib/ads";
import {
  formatAdded,
  formatRating,
  formatViews,
  getVideoById,
  parseKeywords,
  searchVideos,
  toIsoDate,
  toIsoDuration,
  type EpornerVideo,
} from "@/lib/eporner";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 60;

/** Videos fetched per infinite-scroll batch in the related grid. */
const RELATED_BATCH = 18;

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const video = await getVideoById(id);
  if (!video) return { title: "Video not found" };

  const path = `/video/${video.id}`;
  const thumb = video.default_thumb?.src;

  return {
    title: video.title,
    description: `Watch ${video.title} — ${video.length_min} of HD video.`,
    alternates: { canonical: path },
    openGraph: {
      type: "video.other",
      title: video.title,
      url: path,
      images: thumb ? [thumb] : [],
    },
  };
}

async function RelatedSection({
  query,
  currentId,
  categories,
}: {
  query: string;
  currentId: string;
  categories: import("@/lib/categories").Category[];
}) {
  const related = await searchVideos({
    query,
    perPage: RELATED_BATCH,
    order: "top-weekly",
  });
  const videos = related.videos.filter((v) => v.id !== currentId);

  if (videos.length === 0) return null;

  return (
    <InfiniteVideoGrid
      initialVideos={videos}
      totalPages={related.totalPages}
      query={query}
      order="top-weekly"
      batchSize={RELATED_BATCH}
      excludeId={currentId}
      categories={categories}
    />
  );
}

/** Ads + related — deferred so the player HTML streams first. */
async function VideoBelowFold({ video }: { video: EpornerVideo }) {
  const ads = await readAdsConfig();
  const tags = parseKeywords(video.keywords);
  const relatedQuery = tags[0] ?? ads.feed.relatedFallbackQuery;

  return (
    <>
      <AdBanner banner={ads.banners["video-mid"]} className="mt-5" />
      <ExoClickZone network={ads.network} slot="net-video-below" className="mt-5" />
      <AdsterraBanner adsterra={ads.adsterra} slot="ads-video-below" className="mt-5" />

      <section className="mt-12">
        <SectionHeading title="Related Videos" subtitle={`More in “${relatedQuery}”`} />
        <ExoClickZone network={ads.network} slot="net-video-native" className="mb-5 w-full" />
        <Suspense fallback={<GridSkeleton count={RELATED_BATCH} />}>
          <RelatedSection
            query={relatedQuery}
            currentId={video.id}
            categories={ads.feed.categories}
          />
        </Suspense>
      </section>
    </>
  );
}

export default async function VideoPage({ params }: PageProps) {
  const { id } = await params;
  const [video, ads] = await Promise.all([getVideoById(id), readAdsConfig()]);
  if (!video) notFound();

  const tags = parseKeywords(video.keywords);
  const rating = formatRating(video.rate);
  const added = formatAdded(video.added);
  const proxyEnabled = ads.playback?.proxyEnabled !== false;

  const uploadDate = toIsoDate(video.added);
  const duration = toIsoDuration(video.length_sec);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    description: `Watch ${video.title} — ${video.length_min} of HD video.`,
    url: absoluteUrl(`/video/${video.id}`),
    embedUrl: video.embed,
    ...(video.default_thumb?.src ? { thumbnailUrl: [video.default_thumb.src] } : {}),
    ...(uploadDate ? { uploadDate } : {}),
    ...(duration ? { duration } : {}),
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: { "@type": "WatchAction" },
      userInteractionCount: video.views,
    },
    isFamilyFriendly: false,
  };

  return (
    <>
      {/* Warm embed host before the iframe request races ads/thumbs. */}
      <link rel="dns-prefetch" href="https://www.eporner.com" />
      <link rel="preconnect" href="https://www.eporner.com" crossOrigin="anonymous" />
      {video.embed ? <link rel="prefetch" href={video.embed} as="document" /> : null}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <WatchHistoryRecorder video={video} />

      <div>
        <VideoEmbed
          id={video.id}
          embedSrc={video.embed}
          title={video.title}
          poster={video.default_thumb?.src}
          proxyEnabled={proxyEnabled}
        />

        <h1 className="mt-4 text-lg leading-snug font-bold text-ink-100 sm:text-xl">
          {video.title}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ink-700 pb-4 text-sm text-ink-400">
          <span>{formatViews(video.views)} views</span>
          {rating > 0 && (
            <span className="flex items-center gap-1 text-brand-500">
              <Star size={14} fill="currentColor" aria-hidden />
              {rating.toFixed(1)}
            </span>
          )}
          <span>{video.length_min}</span>
          {added && <span>Added {added}</span>}
          <span className="ml-auto flex items-center gap-2">
            <ShareButton
              url={absoluteUrl(`/video/${video.id}`)}
              title={video.title}
            />
            <FavoriteButton video={video} variant="inline" />
          </span>
        </div>

        {tags.length > 0 && (
          <section className="mt-4">
            <h2 className="mb-2 text-sm font-semibold text-ink-300">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/search?q=${encodeURIComponent(tag)}`}
                  className="rounded-full bg-ink-850 px-3 py-1 text-xs font-medium text-ink-300 transition-colors hover:bg-ink-800 hover:text-brand-500"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <Suspense
        fallback={
          <div className="mt-12">
            <div className="mb-4 h-6 w-40 animate-pulse rounded bg-ink-800" />
            <GridSkeleton count={12} />
          </div>
        }
      >
        <VideoBelowFold video={video} />
      </Suspense>
    </>
  );
}
