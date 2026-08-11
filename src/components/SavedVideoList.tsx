"use client";

import Link from "next/link";
import type { VideoSummary } from "@/lib/eporner";
import { useStoredList } from "@/lib/use-stored-list";
import { videoGridClassName } from "@/lib/video-grid";
import SectionHeading from "./SectionHeading";
import VideoCard from "./VideoCard";

interface Props {
  storageKey: string;
  title: string;
  /** Shown when nothing is saved yet. */
  emptyMessage: string;
  clearLabel: string;
  columns?: 1 | 2;
}

/**
 * Renders a localStorage-backed video list.
 *
 * Entries are stored snapshots rather than ids, so this page makes no network
 * calls — the upstream `id` endpoint takes one id per request, which would mean
 * a request per saved video.
 */
export default function SavedVideoList({
  storageKey,
  title,
  emptyMessage,
  clearLabel,
  columns = 2,
}: Props) {
  const { items, clear } = useStoredList<VideoSummary>(storageKey);

  return (
    <>
      <div className="mb-4 flex items-end justify-between gap-4">
        <SectionHeading
          as="h1"
          title={title}
          subtitle={items.length > 0 ? `${items.length} saved` : undefined}
        />
        {items.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="mb-4 shrink-0 rounded-md border border-ink-700 px-3 py-1.5 text-xs font-semibold text-ink-300 transition-colors hover:border-brand-500 hover:text-brand-500"
          >
            {clearLabel}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-ink-700 bg-ink-900 px-6 py-16 text-center">
          <p className="text-lg font-semibold text-ink-100">Nothing here yet</p>
          <p className="mt-2 text-sm text-ink-400">{emptyMessage}</p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-md bg-brand-500 px-5 py-2.5 text-sm font-bold text-black transition-colors hover:bg-brand-600"
          >
            Browse videos
          </Link>
        </div>
      ) : (
        <div className={videoGridClassName(columns)}>
          {items.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </>
  );
}
