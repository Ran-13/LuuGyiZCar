"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  title: string;
  /** Thumbnail shown until the player paints, so the frame is never empty. */
  poster?: string;
}

/** How long to wait for the iframe to signal load before offering a retry. */
const LOAD_TIMEOUT_MS = 9000;

/**
 * Eporner embed iframe, with a poster and a manual retry.
 *
 * Two deliberate choices:
 *
 * - `referrerPolicy` sends the origin. With `no-referrer` the embed CDN cannot
 *   authorise the play session and blanks the frame — reliably reproducible on
 *   iOS Safari while desktop still worked.
 * - The retry control is always available once loading finishes. A cross-origin
 *   iframe that loads a blank page still fires `onLoad` and never fires
 *   `onError`, so the parent page genuinely cannot detect the white-frame case.
 *   Privacy blocking (Safari ITP, Brave shields, ad blockers) causes it and is
 *   outside this page's control, so the honest fix is to let the viewer reload
 *   the player rather than pretend we can auto-detect it.
 */
export default function VideoEmbed({ src, title, poster }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // setState lands in a timer callback, not the effect body.
    timer.current = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [attempt]);

  const reload = () => {
    setLoaded(false);
    setTimedOut(false);
    setAttempt((a) => a + 1);
  };

  // Cache-bust retries so a failed session is not replayed from cache.
  const frameSrc = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}r=${attempt}`;

  // Owns the aspect box so the controls can live *outside* the iframe. Overlaying
  // them would swallow clicks meant for the provider's own player controls.
  return (
    <>
      <div className="relative mx-auto aspect-video w-full max-w-[calc(82vh*16/9)] overflow-hidden rounded-lg bg-ink-900">
      {/* Poster sits underneath: the frame shows artwork instantly instead of a
          white or black box, and this image is already cached from the grid. */}
      {poster && !loaded && (
        // eslint-disable-next-line @next/next/no-img-element -- remote CDN thumbnail
        <img
          src={poster}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-60 blur-[1px]"
        />
      )}

      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/25 border-t-brand-500" />
        </div>
      )}

      <iframe
        key={attempt}
        src={frameSrc}
        title={title}
        className={`absolute inset-0 h-full w-full border-0 transition-opacity duration-300 ${
          loaded ? "bg-black opacity-100" : "opacity-0"
        }`}
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        loading="eager"
        onLoad={() => setLoaded(true)}
      />

      </div>

      {/* Below the player, never over it. Shown once the frame reports loaded
          (which covers the blank-player case) or when it never reported at all. */}
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
