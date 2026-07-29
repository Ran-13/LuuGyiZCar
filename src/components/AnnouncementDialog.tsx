"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { AnnouncementConfig } from "@/lib/ads-types";
import { STORAGE_KEYS } from "@/lib/storage-keys";

interface AnnouncementDialogProps {
  announcement: AnnouncementConfig;
  /** Bumps when admin saves — re-shows the dialog for returning visitors. */
  version: string;
}

function telegramHandle(url: string, fallback = ""): string {
  const fromUrl = url.match(/t\.me\/([A-Za-z0-9_]+)/i)?.[1];
  if (fromUrl) return `@${fromUrl}`;
  if (fallback.startsWith("@")) return fallback;
  if (fallback) return `@${fallback.replace(/^@/, "")}`;
  return fallback;
}

export default function AnnouncementDialog({ announcement, version }: AnnouncementDialogProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!announcement.enabled || !announcement.showDialog || !announcement.text.trim()) {
      return;
    }

    try {
      const seen = window.localStorage.getItem(STORAGE_KEYS.announcementDialogSeen);
      if (seen === version) return;
    } catch {
      // Private mode / blocked storage — still show once this session.
    }

    setOpen(true);
  }, [announcement.enabled, announcement.showDialog, announcement.text, version]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dismiss is stable for this open cycle
  }, [open]);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEYS.announcementDialogSeen, version);
    } catch {
      // ignore
    }
    setOpen(false);
  }

  if (!open) return null;

  const handle = telegramHandle(announcement.contactUrl, announcement.adsContact);

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

          <p className="pr-8 text-[15px] leading-relaxed whitespace-pre-wrap text-white">
            {announcement.text}
          </p>

          {(announcement.contactLabel || handle) && (
            <div className="mt-5 border-t border-ink-700 pt-4">
              {announcement.contactLabel && (
                <p className="text-sm text-ink-300">{announcement.contactLabel}</p>
              )}
              {announcement.contactUrl ? (
                <a
                  href={announcement.contactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-base font-semibold text-brand-500 hover:text-brand-400"
                >
                  {handle || announcement.contactUrl}
                </a>
              ) : handle ? (
                <p className="mt-1 text-base font-semibold text-brand-500">{handle}</p>
              ) : null}
            </div>
          )}

          <button
            type="button"
            onClick={dismiss}
            className="mt-6 w-full rounded-md bg-brand-500 px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-brand-400"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
