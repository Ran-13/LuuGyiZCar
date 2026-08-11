"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface Quality {
  id: string;
  label: string;
  height: number;
  src: string;
}

type ProxyMode = "off" | "always" | "auto";

interface Props {
  /** Eporner video id — used for proxied native playback. */
  id: string;
  /** Official embed URL — iframe fallback if proxy fails. */
  embedSrc: string;
  title: string;
  poster?: string;
  /**
   * off — embed only
   * always — VPS proxy
   * auto — proxy when geoLikelyBlocked / probe fails; else embed (faster seek)
   */
  proxyMode?: ProxyMode;
  /** @deprecated Prefer proxyMode. */
  proxyEnabled?: boolean;
  /**
   * Server hint for auto mode: viewer country is in the blocked list
   * (e.g. MM) so Eporner CDN usually fails without VPN → use proxy.
   */
  preferProxy?: boolean;
}

type Mode = "loading" | "native" | "embed" | "error";

const SKIP_SEC = 60;

/**
 * Auto: embed when Eporner is usable (fast minute-skip); proxy when geo-blocked
 * so viewers without VPN can still play. Always/off override that.
 */
export default function VideoEmbed({
  id,
  embedSrc,
  title,
  poster,
  proxyMode,
  proxyEnabled = true,
  preferProxy = false,
}: Props) {
  const modeResolved: ProxyMode =
    proxyMode ?? (proxyEnabled === false ? "off" : "always");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const resumeAfterSeek = useRef(false);
  const seekingHard = useRef(false);
  const recoverTries = useRef(0);
  const [mode, setMode] = useState<Mode>(() =>
    modeResolved === "off" ? "embed" : "loading",
  );
  const [qualities, setQualities] = useState<Quality[]>([]);
  const [qualityId, setQualityId] = useState<string>("");
  const [attempt, setAttempt] = useState(0);
  const [mediaError, setMediaError] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const active = qualities.find((q) => q.id === qualityId) ?? qualities[0];

  const loadProxyPlayback = useCallback(async () => {
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
  }, [id]);

  /** Quick check: can the browser reach Eporner at all? */
  const probeEpornerReachable = useCallback(async (): Promise<boolean> => {
    try {
      await fetch("https://www.eporner.com/favicon.ico", {
        mode: "no-cors",
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (modeResolved === "off") return;

    let cancelled = false;

    const run = async () => {
      if (modeResolved === "always" || preferProxy) {
        if (!cancelled) await loadProxyPlayback();
        return;
      }

      // auto + not geo-blocked: prefer embed when Eporner is reachable.
      const reachable = await probeEpornerReachable();
      if (cancelled) return;
      if (reachable) {
        setMode("embed");
        return;
      }
      await loadProxyPlayback();
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [modeResolved, preferProxy, loadProxyPlayback, probeEpornerReachable, attempt]);

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

  const useProxy = () => {
    void loadProxyPlayback();
  };

  const skipBy = (delta: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
    seekingHard.current = true;
    resumeAfterSeek.current = !v.paused;
    const next = Math.max(0, Math.min(v.duration - 0.25, v.currentTime + delta));
    try {
      v.currentTime = next;
    } catch {
      seekingHard.current = false;
    }
  };

  const recoverAfterError = () => {
    const v = videoRef.current;
    if (!v || !active) return;
    // Abort while scrubbing is normal — do not thrash the source.
    if (seekingHard.current) return;
    if (v.error?.code === MediaError.MEDIA_ERR_ABORTED) return;
    if (recoverTries.current >= 1) return;
    recoverTries.current += 1;
    const t = v.currentTime || 0;
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
              seekingHard.current = false;
            }}
            onCanPlay={() => setWaiting(false)}
            onSeeking={() => {
              seekingHard.current = true;
              resumeAfterSeek.current = !(videoRef.current?.paused ?? true);
              setWaiting(true);
            }}
            onSeeked={() => {
              seekingHard.current = false;
              setWaiting(false);
              const v = videoRef.current;
              if (v && resumeAfterSeek.current) {
                void v.play().catch(() => undefined);
              }
            }}
            onError={() => {
              const v = videoRef.current;
              if (seekingHard.current || v?.error?.code === MediaError.MEDIA_ERR_ABORTED) {
                return;
              }
              setMediaError(true);
              setWaiting(false);
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
          <button
            type="button"
            onClick={() => skipBy(-SKIP_SEC)}
            className="rounded-md border border-ink-700 px-2.5 py-1.5 text-xs font-semibold text-ink-300 hover:border-brand-500 hover:text-brand-500"
          >
            −1 min
          </button>
          <button
            type="button"
            onClick={() => skipBy(SKIP_SEC)}
            className="rounded-md border border-ink-700 px-2.5 py-1.5 text-xs font-semibold text-ink-300 hover:border-brand-500 hover:text-brand-500"
          >
            +1 min
          </button>

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

          {mediaError || modeResolved === "auto" ? (
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
        {modeResolved !== "off" ? (
          <>
            <p className="text-xs text-ink-500">
              {modeResolved === "auto" ? "Direct embed (faster seek)" : "Embed fallback"}
            </p>
            <button
              type="button"
              onClick={useProxy}
              className="ml-auto flex items-center gap-1.5 rounded-md border border-ink-700 px-2.5 py-1.5 text-xs font-semibold text-ink-300 hover:border-brand-500 hover:text-brand-500"
            >
              {modeResolved === "auto" ? "Can't play? Use proxy" : "Try proxy again"}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
