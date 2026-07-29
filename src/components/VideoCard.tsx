"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import type { VideoSummary } from "@/lib/eporner";
import { formatAdded, formatRating, formatViews } from "@/lib/eporner";
import FavoriteButton from "./FavoriteButton";

interface Props {
  video: VideoSummary;
  /** Only the first visible row should load eagerly — everything below stays lazy. */
  priority?: boolean;
}

const SCRUB_INTERVAL_MS = 600;

/** Rating is 0–5 upstream; the bar under the thumb renders it as a percentage. */
const MAX_RATING = 5;

export default function VideoCard({ video, priority = false }: Props) {
  const frames = video.thumbs?.length ? video.thumbs : [video.default_thumb];
  const [frame, setFrame] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopScrub = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    setFrame(0);
  };

  const startScrub = () => {
    if (timer.current || frames.length < 2) return;
    timer.current = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, SCRUB_INTERVAL_MS);
  };

  const rating = formatRating(video.rate);
  const added = formatAdded(video.added);
  const src = frames[frame]?.src ?? video.default_thumb?.src;
  const isHd = (video.default_thumb?.width ?? 0) >= 640;

  return (
    <article
      className="group relative"
      onMouseEnter={startScrub}
      onMouseLeave={stopScrub}
      onFocus={startScrub}
      onBlur={stopScrub}
    >
      {/* Sibling of the link, not a child: a <button> inside an <a> is invalid
          HTML and breaks keyboard navigation. Positioned against the article,
          whose top-right corner is the thumbnail's top-right corner. */}
      <FavoriteButton video={video} />

      <Link href={`/video/${video.id}`} className="block">
        <div className="relative aspect-video overflow-hidden rounded-md bg-ink-800 ring-brand-500/0 transition-all duration-200 group-hover:ring-2 group-hover:ring-brand-500/70">
          {src ? (
            <Image
              src={src}
              alt={video.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 25vw, 17vw"
              className="object-cover"
              priority={priority}
              // Scrub frames are transient; skipping the optimizer avoids 15 extra
              // image requests per card on hover.
              unoptimized={frame > 0}
            />
          ) : (
            <div className="h-full w-full bg-ink-800" />
          )}

          {isHd && (
            <span className="absolute top-1.5 left-1.5 rounded-sm bg-brand-500 px-1.5 py-px text-[10px] leading-tight font-black tracking-wide text-black">
              HD
            </span>
          )}

          <span className="absolute right-1.5 bottom-1.5 rounded-sm bg-black/85 px-1.5 py-px text-[11px] font-semibold tabular-nums text-white">
            {video.length_min}
          </span>

          {/* Frame ticks double as a scrub-position indicator on hover. */}
          {frames.length > 1 && (
            <span className="absolute inset-x-0 bottom-0 flex gap-px opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {frames.map((_, i) => (
                <span
                  key={i}
                  className={`h-0.5 flex-1 ${i <= frame ? "bg-brand-500" : "bg-white/25"}`}
                />
              ))}
            </span>
          )}
        </div>

        {/* Fixed two-line box keeps the rating bar and meta row aligned across a grid row. */}
        <h3 className="mt-2 line-clamp-2 min-h-9 text-[13px] leading-snug font-medium text-ink-100 transition-colors group-hover:text-brand-500">
          {video.title}
        </h3>
      </Link>

      {rating > 0 && (
        <div className="mt-0.5 h-[3px] w-full overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full rounded-full bg-brand-500"
            style={{ width: `${(rating / MAX_RATING) * 100}%` }}
          />
        </div>
      )}

      {/* Single line by design — the date drops out on narrow cards rather than wrapping. */}
      <div className="mt-1 flex items-center gap-x-1.5 overflow-hidden text-[11px] whitespace-nowrap text-ink-400">
        <span className="font-medium text-ink-300">{formatViews(video.views)}</span>
        <span>views</span>
        {rating > 0 && (
          <>
            <span aria-hidden>·</span>
            <span className="font-semibold text-brand-500">{rating.toFixed(1)}</span>
          </>
        )}
        {added && (
          <span className="hidden items-center gap-x-1.5 sm:flex">
            <span aria-hidden>·</span>
            <span>{added}</span>
          </span>
        )}
      </div>
    </article>
  );
}
