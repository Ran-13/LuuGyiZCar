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

/**
 * The related query depends on tags parsed from the video, so this fetch is
 * genuinely sequential after `getVideoById`. Isolating it behind Suspense lets
 * the player paint after the first call instead of waiting for both.
 */
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

export default async function VideoPage({ params }: PageProps) {
  const { id } = await params;
  const [video, ads] = await Promise.all([getVideoById(id), readAdsConfig()]);
  if (!video) notFound();

  const tags = parseKeywords(video.keywords);

  // Related videos key off the first usable tag; falls back to site feed setting.
  const relatedQuery = tags[0] ?? ads.feed.relatedFallbackQuery;

  const rating = formatRating(video.rate);
  const added = formatAdded(video.added);

  // schema.org VideoObject — what produces thumbnail + duration rich results.
  // Optional fields are omitted rather than emitted empty, which validators flag.
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
      <script
        type="application/ld+json"
        // Values come from the upstream API, so they are serialized, never interpolated raw.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <WatchHistoryRecorder video={video} />

      <div>
        {/* VideoEmbed owns the aspect box (full width, capped at 82vh tall) so its
            reload controls can sit below the frame rather than over it. */}
        <VideoEmbed src={video.embed} title={video.title} poster={video.default_thumb?.src} />

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

        <AdBanner banner={ads.banners["video-mid"]} className="mt-5" />

        <ExoClickZone network={ads.network} slot="net-video-below" className="mt-5" />
        <AdsterraBanner adsterra={ads.adsterra} slot="ads-video-below" className="mt-5" />
      </div>

      <section className="mt-12">
        {/* Heading renders immediately; only the grid waits on the second fetch. */}
        <SectionHeading title="Related Videos" subtitle={`More in “${relatedQuery}”`} />
        {/* Native / recommendation widget — blends under the related heading, not a tall banner. */}
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
