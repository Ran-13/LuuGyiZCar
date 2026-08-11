"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { VideoSummary } from "@/lib/eporner";
import { formatAdded, formatViews } from "@/lib/eporner";
import { detectCategoryLabel, type Category } from "@/lib/categories";
import FavoriteButton from "./FavoriteButton";

interface Props {
  video: VideoSummary;
  /** Only the first visible row should load eagerly — everything below stays lazy. */
  priority?: boolean;
  categories?: Category[];
}

const SCRUB_INTERVAL_MS = 600;

export default function VideoCard({ video, priority = false, categories }: Props) {
  const frames = video.thumbs?.length ? video.thumbs : [video.default_thumb];
  const [frame, setFrame] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const categoryLabel = detectCategoryLabel(video.keywords ?? "", categories);

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

  const added = formatAdded(video.added);
  const src = frames[frame]?.src ?? video.default_thumb?.src;
  const isHd = (video.default_thumb?.width ?? 0) >= 640;
  const category = categoryLabel;

  return (
    <article
      // transition-[…] rather than transition-all: `all` makes the browser watch
      // every animatable property on every card, including layout-affecting ones.
      className="card-cv group relative rounded-lg bg-ink-900 p-1.5 transition-[background-color,box-shadow] duration-200 hover:bg-ink-800 hover:shadow-lg hover:shadow-black/40"
      onMouseEnter={startScrub}
      onMouseLeave={stopScrub}
      onFocus={startScrub}
      onBlur={stopScrub}
    >
      {/* Sibling of the link, not a child: a <button> inside an <a> is invalid
          HTML and breaks keyboard navigation. Positioned against the article,
          whose top-right corner is the thumbnail's top-right corner. */}
      <FavoriteButton video={video} />

      {/*
        Plain <a>, not next/link: ExoClick Fullpage Interstitial ("Clicking on
        Links") intercepts a real navigation. Next.js soft-routing skips that
        and the interstitial never shows between grid → video page.
      */}
      <a href={`/video/${video.id}`} className="exo-int-trigger block">
        <div className="relative aspect-video overflow-hidden rounded-md bg-ink-800 transition-transform duration-200 group-hover:scale-[1.02]">
          {src ? (
            <Image
              src={src}
              alt={video.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 25vw, 17vw"
              className="object-cover"
              priority={priority}
              unoptimized={frame > 0}
            />
          ) : (
            <div className="h-full w-full bg-ink-800" />
          )}

          {/* Top-left badges */}
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
            {isHd && (
              <span className="rounded-sm bg-brand-500 px-1.5 py-px text-[10px] leading-tight font-black tracking-wide text-black">
                HD
              </span>
            )}
            {category && (
              <span className="rounded-sm bg-black/70 px-1.5 py-px text-[10px] leading-tight font-semibold text-ink-300 backdrop-blur-sm">
                {category}
              </span>
            )}
          </div>

          <span className="absolute right-1.5 bottom-1.5 rounded-sm bg-black/85 px-1.5 py-px text-[11px] font-semibold tabular-nums text-white">
            {video.length_min}
          </span>

          {/* Frame ticks — scrub indicator */}
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

        <h3 className="mt-2 line-clamp-2 min-h-9 px-0.5 text-[13px] leading-snug font-medium text-ink-100 transition-colors group-hover:text-white">
          {video.title}
        </h3>
      </a>

      {/* Meta row — views + date, no rating bar */}
      <div className="mt-1 flex items-center gap-x-1.5 overflow-hidden px-0.5 text-[11px] whitespace-nowrap text-ink-400">
        <span className="font-medium text-ink-300">{formatViews(video.views)}</span>
        <span>views</span>
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
