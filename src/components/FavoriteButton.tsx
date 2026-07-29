"use client";

import { Heart } from "lucide-react";
import type { MouseEvent } from "react";
import { toVideoSummary, type VideoSummary } from "@/lib/eporner";
import { MAX_FAVORITES, STORAGE_KEYS } from "@/lib/storage-keys";
import { useStoredList } from "@/lib/use-stored-list";

interface Props {
  video: VideoSummary;
  /** "overlay" sits on the thumbnail; "inline" sits in the video page meta row. */
  variant?: "overlay" | "inline";
}

export default function FavoriteButton({ video, variant = "overlay" }: Props) {
  const { items, toggle } = useStoredList<VideoSummary>(STORAGE_KEYS.favorites, MAX_FAVORITES);
  const isFavorite = items.some((item) => item.id === video.id);

  const onClick = (event: MouseEvent) => {
    // Cards wrap the thumbnail in a link — without this the click navigates away.
    event.preventDefault();
    event.stopPropagation();
    // Trim before persisting — thumbs[] alone is ~15 URLs per video.
    toggle(toVideoSummary(video));
  };

  const heart = (
    <Heart
      size={variant === "inline" ? 16 : 15}
      // Filled when saved, outline when not — the whole affordance of the control.
      fill={isFavorite ? "currentColor" : "none"}
      aria-hidden
    />
  );

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors ${
          isFavorite
            ? "border-brand-500 text-brand-500"
            : "border-ink-700 text-ink-300 hover:border-brand-500 hover:text-brand-500"
        }`}
      >
        {heart}
        {isFavorite ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      className={`absolute top-1.5 right-1.5 z-10 rounded-md bg-black/70 p-1.5 backdrop-blur-sm transition-all hover:bg-black/90 ${
        isFavorite
          ? "text-brand-500 opacity-100"
          : "text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      }`}
    >
      {heart}
    </button>
  );
}
