"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface Quality {
  id: string;
  label: string;
  height: number;
  src: string;
}

interface Props {
  /** Eporner video id — used for proxied native playback. */
  id: string;
  /** Official embed URL — iframe fallback if proxy fails. */
  embedSrc: string;
  title: string;
  poster?: string;
}

type Mode = "loading" | "native" | "embed" | "error";

/**
 * Plays via our VPS stream proxy (no viewer VPN needed). Falls back to the
 * Eporner iframe if sources cannot be resolved.
 */
export default function VideoEmbed({ id, embedSrc, title, poster }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [mode, setMode] = useState<Mode>("loading");
  const [qualities, setQualities] = useState<Quality[]>([]);
  const [qualityId, setQualityId] = useState<string>("");
  const [attempt, setAttempt] = useState(0);
  const [mediaError, setMediaError] = useState(false);

  const active = qualities.find((q) => q.id === qualityId) ?? qualities[0];

  const loadPlayback = useCallback(async () => {
    setMode("loading");
    setMediaError(false);
    try {
      const res = await fetch(`/api/playback/${encodeURIComponent(id)}`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`playback ${res.status}`);
      const data = (await res.json()) as {
        ok?: boolean;
        defaultQuality?: string | null;
        qualities?: Quality[];
      };
      if (!data.ok || !data.qualities?.length) throw new Error("no qualities");
      setQualities(data.qualities);
      setQualityId(data.defaultQuality || data.qualities[0].id);
      setMode("native");
    } catch {
      setQualities([]);
      setMode("embed");
    }
  }, [id]);

  useEffect(() => {
    void loadPlayback();
  }, [loadPlayback, attempt]);

  const onQualityChange = (nextId: string) => {
    const el = videoRef.current;
    const t = el?.currentTime ?? 0;
    const wasPaused = el?.paused ?? true;
    setQualityId(nextId);
    // Apply after src swap on next paint.
    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (!v) return;
      const resume = () => {
        v.currentTime = t;
        if (!wasPaused) void v.play().catch(() => undefined);
        v.removeEventListener("loadedmetadata", resume);
      };
      v.addEventListener("loadedmetadata", resume);
      v.load();
    });
  };

  const reload = () => {
    setAttempt((a) => a + 1);
  };

  const useEmbed = () => setMode("embed");

  if (mode === "loading") {
    return (
      <div className="relative mx-auto aspect-video w-full max-w-[calc(82vh*16/9)] overflow-hidden rounded-lg bg-black">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover opacity-70"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/25 border-t-brand-500" />
        </div>
      </div>
    );
  }

  if (mode === "native" && active) {
    return (
      <div className="mx-auto w-full max-w-[calc(82vh*16/9)]">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
          <video
            key={`${active.id}-${attempt}`}
            ref={videoRef}
            className="absolute inset-0 h-full w-full bg-black"
            controls
            playsInline
            preload="metadata"
            poster={poster}
            src={active.src}
            title={title}
            onError={() => setMediaError(true)}
            onPlaying={() => setMediaError(false)}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-ink-400">
            Quality
            <select
              value={active.id}
              onChange={(e) => onQualityChange(e.target.value)}
              className="rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-100 outline-none focus:border-brand-500"
            >
              {qualities.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.height === 360 ? `Auto (${q.label})` : q.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={reload}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-ink-700 px-2.5 py-1.5 text-xs font-semibold text-ink-300 hover:border-brand-500 hover:text-brand-500"
          >
            <RotateCcw size={13} aria-hidden />
            Reload
          </button>

          {mediaError ? (
            <button
              type="button"
              onClick={useEmbed}
              className="rounded-md border border-ink-700 px-2.5 py-1.5 text-xs font-semibold text-ink-300 hover:border-brand-500 hover:text-brand-500"
            >
              Use embed player
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  // Embed fallback (Eporner iframe — may need VPN in some regions).
  const frameSrc =
    attempt === 0 ? embedSrc : `${embedSrc}${embedSrc.includes("?") ? "&" : "?"}r=${attempt}`;

  return (
    <div className="mx-auto w-full max-w-[calc(82vh*16/9)]">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
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
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="text-xs text-ink-500">Embed fallback</p>
        <button
          type="button"
          onClick={reload}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-ink-700 px-2.5 py-1.5 text-xs font-semibold text-ink-300 hover:border-brand-500 hover:text-brand-500"
        >
          <RotateCcw size={13} aria-hidden />
          Try proxy again
        </button>
      </div>
    </div>
  );
}
