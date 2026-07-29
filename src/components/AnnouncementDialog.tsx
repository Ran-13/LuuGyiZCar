"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { AnnouncementConfig } from "@/lib/ads-types";

interface AnnouncementDialogProps {
  announcement: AnnouncementConfig;
}

function telegramHandle(url: string, fallback = ""): string {
  const fromUrl = url.match(/t\.me\/([A-Za-z0-9_]+)/i)?.[1];
  if (fromUrl) return `@${fromUrl}`;
  if (fallback.startsWith("@")) return fallback;
  if (fallback) return `@${fallback.replace(/^@/, "")}`;
  return fallback;
}

export default function AnnouncementDialog({ announcement }: AnnouncementDialogProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogs = announcement.dialogs.filter((dialog) => dialog.enabled && dialog.text.trim());

  // Derived, not set from an effect. `announcement` is server-rendered props, so
  // server and client compute the same value — no hydration mismatch, no second
  // render on every page load, and no visible flash of the dialog appearing
  // after first paint.
  const [open, setOpen] = useState(
    () => announcement.enabled && announcement.showDialog && dialogs.length > 0,
  );
  const [index, setIndex] = useState(0);
  const current = dialogs[index];

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function dismiss() {
    setOpen(false);
  }

  function next() {
    if (index >= dialogs.length - 1) {
      setOpen(false);
      return;
    }
    setIndex((value) => value + 1);
  }

  if (!open || !current) return null;

  const handle = telegramHandle(current.contactUrl, announcement.adsContact);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close announcement"
        className="absolute inset-0 bg-black/75"
        onClick={dismiss}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-ink-700 bg-black shadow-2xl"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
        >
          <X size={18} aria-hidden />
        </button>

        <div className="px-5 pt-6 pb-5 sm:px-6">
          <h2 id={titleId} className="sr-only">
            Announcement
          </h2>

          {current.title ? (
            <p className="pr-8 text-base font-semibold text-brand-500">{current.title}</p>
          ) : null}
          <p className="pr-8 text-[15px] leading-relaxed whitespace-pre-wrap text-white">
            {current.text}
          </p>

          {(current.contactLabel || handle) && (
            <div className="mt-5 border-t border-ink-700 pt-4">
              {current.contactLabel && (
                <p className="text-sm text-ink-300">{current.contactLabel}</p>
              )}
              {current.contactUrl ? (
                <a
                  href={current.contactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-base font-semibold text-brand-500 hover:text-brand-400"
                >
                  {handle || current.contactUrl}
                </a>
              ) : handle ? (
                <p className="mt-1 text-base font-semibold text-brand-500">{handle}</p>
              ) : null}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <span className="text-xs text-ink-400">
              {index + 1} / {dialogs.length}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={dismiss}
                className="rounded-md border border-ink-700 px-4 py-2.5 text-sm font-medium text-ink-200 transition-colors hover:bg-ink-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={next}
                className="rounded-md bg-brand-500 px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-brand-400"
              >
                {index >= dialogs.length - 1 ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
