"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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
/** Wait before cycling frames so quick hover/scroll does not flood the CDN. */
const SCRUB_DWELL_MS = 180;

function prefetchEmbed(url: string | undefined) {
  if (!url || typeof document === "undefined") return;
  const id = `prefetch-embed-${url}`;
  if (document.getElementById(id)) return;
  try {
    const origin = new URL(url).origin;
    if (!document.getElementById(`preconnect-${origin}`)) {
      const pc = document.createElement("link");
      pc.id = `preconnect-${origin}`;
      pc.rel = "preconnect";
      pc.href = origin;
      pc.crossOrigin = "anonymous";
      document.head.appendChild(pc);
    }
  } catch {
    return;
  }
  const link = document.createElement("link");
  link.id = id;
  link.rel = "prefetch";
  link.href = url;
  link.as = "document";
  document.head.appendChild(link);
}

export default function VideoCard({ video, priority = false, categories }: Props) {
  const frames = video.thumbs?.length ? video.thumbs : [video.default_thumb];
  const [frame, setFrame] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dwellRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoryLabel = detectCategoryLabel(video.keywords ?? "", categories);

  const clearTimers = () => {
    if (dwellRef.current) {
      clearTimeout(dwellRef.current);
      dwellRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const stopScrub = () => {
    clearTimers();
    setFrame(0);
  };

  const startScrub = () => {
    prefetchEmbed(video.embed);
    if (intervalRef.current || dwellRef.current || frames.length < 2) return;
    // Touch / coarse pointers don't get hover scrub — saves bandwidth while scrolling.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(hover: none), (pointer: coarse)").matches
    ) {
      return;
    }
    dwellRef.current = setTimeout(() => {
      dwellRef.current = null;
      intervalRef.current = setInterval(() => {
        setFrame((f) => (f + 1) % frames.length);
      }, SCRUB_INTERVAL_MS);
    }, SCRUB_DWELL_MS);
  };

  useEffect(() => () => clearTimers(), []);

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
      onTouchStart={() => prefetchEmbed(video.embed)}
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
