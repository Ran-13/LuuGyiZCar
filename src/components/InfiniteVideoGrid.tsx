"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mergeUniqueById, type EpornerVideo, type SortOrder } from "@/lib/eporner";
import type { Category } from "@/lib/categories";
import VideoCard from "./VideoCard";

interface Props {
  /** Page 1, rendered on the server so the grid is never empty on load. */
  initialVideos: EpornerVideo[];
  totalPages: number;
  /** The same query the server used, so scrolling continues the same feed. */
  query: string;
  order: SortOrder;
  batchSize: number;
  /** Optional id to keep out of every batch (the video you are already watching). */
  excludeId?: string;
  /** Eagerly load the first row — only for the topmost grid on a page. */
  priorityCount?: number;
  /** Site categories for the card chip (falls back to defaults inside VideoCard). */
  categories?: Category[];
}

/** Start fetching before the sentinel is actually on screen. */
const PREFETCH_MARGIN = "800px";

export default function InfiniteVideoGrid({
  initialVideos,
  totalPages,
  query,
  order,
  batchSize,
  excludeId,
  priorityCount = 0,
  categories,
}: Props) {
  const [videos, setVideos] = useState(initialVideos);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const hasMore = page < totalPages;

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(false);
    const next = page + 1;

    try {
      const params = new URLSearchParams({
        q: query,
        page: String(next),
        per_page: String(batchSize),
        order,
      });
      const res = await fetch(`/api/videos?${params}`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const data = (await res.json()) as { videos: EpornerVideo[] };

      setVideos((prev) => mergeUniqueById(prev, data.videos, excludeId));
      setPage(next);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, query, order, batchSize, excludeId]);

  useEffect(() => {
    const el = sentinelRef.current;
    // While an error is showing, wait for an explicit retry instead of
    // hammering the endpoint every time the sentinel scrolls into view.
    if (!el || !hasMore || error) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: PREFETCH_MARGIN },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, hasMore, error]);

  return (
    <>
      <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-4 sm:gap-y-6 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {videos.map((video, i) => (
          <VideoCard
            key={video.id}
            video={video}
            priority={i < priorityCount}
            categories={categories}
          />
        ))}
      </div>

      <div ref={sentinelRef} aria-hidden className="h-px w-full" />

      <div className="mt-8 flex justify-center" aria-live="polite">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-ink-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-600 border-t-brand-500" />
            Loading more…
          </div>
        )}

        {/* Also a manual control: the observer can be suppressed by reduced-motion
            or background-tab heuristics, and this doubles as the retry affordance. */}
        {!loading && hasMore && (
          <button
            type="button"
            onClick={loadMore}
            className="rounded-md border border-ink-700 bg-ink-850 px-6 py-2.5 text-sm font-semibold text-ink-300 transition-colors hover:border-brand-500 hover:text-brand-500"
          >
            {error ? "Could not load more — Retry" : "Load more"}
          </button>
        )}

        {!loading && !error && !hasMore && (
          <p className="text-sm text-ink-400">You have reached the end.</p>
        )}
      </div>
    </>
  );
}
