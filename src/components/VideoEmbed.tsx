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
  /** When false, skip proxy and use Eporner embed only. */
  proxyEnabled?: boolean;
}

type Mode = "loading" | "native" | "embed" | "error";

/**
 * Plays via our VPS stream proxy (no viewer VPN needed). Falls back to the
 * Eporner iframe if sources cannot be resolved.
 */
export default function VideoEmbed({
  id,
  embedSrc,
  title,
  poster,
  proxyEnabled = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const resumeAfterSeek = useRef(false);
  const recoverTries = useRef(0);
  const [mode, setMode] = useState<Mode>(proxyEnabled ? "loading" : "embed");
  const [qualities, setQualities] = useState<Quality[]>([]);
  const [qualityId, setQualityId] = useState<string>("");
  const [attempt, setAttempt] = useState(0);
  const [mediaError, setMediaError] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const active = qualities.find((q) => q.id === qualityId) ?? qualities[0];

  const loadPlayback = useCallback(async () => {
    if (!proxyEnabled) {
      setMode("embed");
      return;
    }
    setMode("loading");
    setMediaError(false);
    try {
      const res = await fetch(`/api/playback/${encodeURIComponent(id)}`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`playback ${res.status}`);
      const data = (await res.json()) as {
        ok?: boolean;
        proxyDisabled?: boolean;
        defaultQuality?: string | null;
        qualities?: Quality[];
      };
      if (data.proxyDisabled) {
        setMode("embed");
        return;
      }
      if (!data.ok || !data.qualities?.length) throw new Error("no qualities");
      setQualities(data.qualities);
      setQualityId(data.defaultQuality || data.qualities[0].id);
      setMode("native");
    } catch {
      setQualities([]);
      setMode("embed");
    }
  }, [id, proxyEnabled]);

  useEffect(() => {
    void loadPlayback();
  }, [loadPlayback, attempt]);

  const onQualityChange = (nextId: string) => {
    const el = videoRef.current;
    const t = el?.currentTime ?? 0;
    const wasPaused = el?.paused ?? true;
    setQualityId(nextId);
    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (!v) return;
      const resume = () => {
        try {
          if (Number.isFinite(t) && t > 0) v.currentTime = t;
        } catch {
          /* ignore seek until buffer ready */
        }
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

  const recoverAfterError = () => {
    const v = videoRef.current;
    if (!v || !active) return;
    if (recoverTries.current >= 1) return;
    recoverTries.current += 1;
    const t = v.currentTime || 0;
    // Bust any broken partial buffer and retry the same proxied URL.
    const url = `${active.src}${active.src.includes("?") ? "&" : "?"}r=${Date.now()}`;
    v.src = url;
    v.load();
    const onMeta = () => {
      try {
        if (t > 0) v.currentTime = t;
      } catch {
        /* ignore */
      }
      void v.play().catch(() => undefined);
      v.removeEventListener("loadedmetadata", onMeta);
    };
    v.addEventListener("loadedmetadata", onMeta);
  };

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
            preload="auto"
            poster={poster}
            src={active.src}
            title={title}
            onWaiting={() => setWaiting(true)}
            onPlaying={() => {
              setWaiting(false);
              setMediaError(false);
              recoverTries.current = 0;
            }}
            onCanPlay={() => setWaiting(false)}
            onSeeking={() => {
              resumeAfterSeek.current = !(videoRef.current?.paused ?? true);
              setWaiting(true);
            }}
            onSeeked={() => {
              setWaiting(false);
              const v = videoRef.current;
              if (v && resumeAfterSeek.current) {
                void v.play().catch(() => undefined);
              }
            }}
            onError={() => {
              setMediaError(true);
              setWaiting(false);
              // One automatic recovery pass for failed Range/seek.
              recoverAfterError();
            }}
          />
          {waiting ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-brand-500" />
            </div>
          ) : null}
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
        {proxyEnabled ? (
          <>
            <p className="text-xs text-ink-500">Embed fallback</p>
            <button
              type="button"
              onClick={reload}
              className="ml-auto flex items-center gap-1.5 rounded-md border border-ink-700 px-2.5 py-1.5 text-xs font-semibold text-ink-300 hover:border-brand-500 hover:text-brand-500"
            >
              <RotateCcw size={13} aria-hidden />
              Try proxy again
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
