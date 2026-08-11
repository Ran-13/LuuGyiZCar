"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  title: string;
  /** Thumbnail shown until the player paints, so the frame is never empty. */
  poster?: string;
}

/** How long to wait before offering a retry if the frame never settles. */
const LOAD_TIMEOUT_MS = 7000;

/**
 * Eporner embed iframe, with a poster and a manual retry.
 *
 * Speed notes:
 * - The iframe is visible immediately (not opacity-0 until onLoad). Waiting for
 *   onLoad hid the player until Eporner's own page+ads finished — felt stuck.
 * - Poster covers the frame until load, then fades so there is never a blank box.
 * - referrerPolicy must send the origin; no-referrer blanks the player on iOS.
 */
export default function VideoEmbed({ src, title, poster }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Warm the embed origin as soon as the player mounts (video route only).
    try {
      const origin = new URL(src).origin;
      const ensure = (rel: string) => {
        const id = `vid-${rel}-${origin}`;
        if (document.getElementById(id)) return;
        const link = document.createElement("link");
        link.id = id;
        link.rel = rel;
        link.href = origin;
        if (rel === "preconnect") link.crossOrigin = "anonymous";
        document.head.appendChild(link);
      };
      ensure("dns-prefetch");
      ensure("preconnect");
    } catch {
      /* bad src */
    }
  }, [src]);

  useEffect(() => {
    setLoaded(false);
    setTimedOut(false);
    timer.current = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [attempt, src]);

  const reload = () => {
    setLoaded(false);
    setTimedOut(false);
    setAttempt((a) => a + 1);
  };

  // Cache-bust retries so a failed session is not replayed from cache.
  const frameSrc = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}r=${attempt}`;

  return (
    <>
      <div className="relative mx-auto aspect-video w-full max-w-[calc(82vh*16/9)] overflow-hidden rounded-lg bg-black">
        {/* Iframe starts visible so Eporner's own loader/player can paint ASAP. */}
        <iframe
          key={attempt}
          src={frameSrc}
          title={title}
          className="absolute inset-0 h-full w-full border-0 bg-black"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="eager"
          {...{ fetchPriority: "high" }}
          onLoad={() => {
            setLoaded(true);
            if (timer.current) clearTimeout(timer.current);
          }}
        />

        {/* Poster + spinner only until the embed document fires load. */}
        {!loaded && (
          <div className="pointer-events-none absolute inset-0 z-[1]">
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote CDN thumbnail
              <img
                src={poster}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover opacity-70"
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
            ) : (
              <div className="absolute inset-0 bg-ink-900" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/35">
              <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/25 border-t-brand-500" />
            </div>
          </div>
        )}
      </div>

      {(loaded || timedOut) && (
        <div className="mx-auto mt-2 flex max-w-[calc(82vh*16/9)] items-center justify-end gap-2">
          {timedOut && !loaded && (
            <span className="mr-auto text-xs text-ink-400">Player is taking a while…</span>
          )}
          <button
            type="button"
            onClick={reload}
            className="flex items-center gap-1.5 rounded-md border border-ink-700 px-2.5 py-1.5 text-xs font-semibold text-ink-300 transition-colors hover:border-brand-500 hover:text-brand-500"
          >
            <RotateCcw size={13} aria-hidden />
            Reload player
          </button>
        </div>
      )}
    </>
  );
}
