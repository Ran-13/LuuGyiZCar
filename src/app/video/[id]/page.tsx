import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import InfiniteVideoGrid from "@/components/InfiniteVideoGrid";
import SectionHeading from "@/components/SectionHeading";
import {
  formatAdded,
  formatRating,
  formatViews,
  getVideoById,
  parseKeywords,
  searchVideos,
} from "@/lib/eporner";

export const revalidate = 900;

/** Videos fetched per infinite-scroll batch in the related grid. */
const RELATED_BATCH = 18;

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const video = await getVideoById(id);
  if (!video) return { title: "Video not found" };

  return {
    title: video.title,
    openGraph: {
      title: video.title,
      images: video.default_thumb?.src ? [video.default_thumb.src] : [],
    },
  };
}

export default async function VideoPage({ params }: PageProps) {
  const { id } = await params;
  const video = await getVideoById(id);
  if (!video) notFound();

  const tags = parseKeywords(video.keywords);

  // Related videos key off the first usable tag; falls back to the busiest generic term.
  const relatedQuery = tags[0] ?? "asian";
  const related = await searchVideos({
    query: relatedQuery,
    perPage: RELATED_BATCH,
    order: "top-weekly",
  });
  const relatedVideos = related.videos.filter((v) => v.id !== video.id);

  const rating = formatRating(video.rate);
  const added = formatAdded(video.added);

  return (
    <>
      <div>
        {/* Full width, but never taller than the viewport — at very wide sizes the
            16:9 box would otherwise push the title and tags off screen. */}
        <div className="relative mx-auto aspect-video w-full max-w-[calc(82vh*16/9)] overflow-hidden rounded-lg bg-black">
          <iframe
            src={video.embed}
            title={video.title}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; fullscreen; encrypted-media"
            allowFullScreen
            referrerPolicy="no-referrer"
            loading="eager"
          />
        </div>

        <h1 className="mt-4 text-lg leading-snug font-bold text-ink-100 sm:text-xl">
          {video.title}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ink-700 pb-4 text-sm text-ink-400">
          <span>{formatViews(video.views)} views</span>
          {rating > 0 && (
            <span className="flex items-center gap-1 text-brand-500">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="m12 2 3 6.6 7 .9-5 4.9 1.2 7L12 18l-6.2 3.4L7 14.4l-5-4.9 7-.9z" />
              </svg>
              {rating.toFixed(1)}
            </span>
          )}
          <span>{video.length_min}</span>
          {added && <span>Added {added}</span>}
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="ml-auto text-ink-400 underline-offset-2 transition-colors hover:text-brand-500 hover:underline"
          >
            Source ↗
          </a>
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

      {relatedVideos.length > 0 && (
        <section className="mt-12">
          <SectionHeading title="Related Videos" subtitle={`More in “${relatedQuery}”`} />
          <InfiniteVideoGrid
            initialVideos={relatedVideos}
            totalPages={related.totalPages}
            query={relatedQuery}
            order="top-weekly"
            batchSize={RELATED_BATCH}
            excludeId={video.id}
          />
        </section>
      )}
    </>
  );
}
