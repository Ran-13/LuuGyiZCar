"use client";

import { useEffect, useRef } from "react";
import { toVideoSummary, type VideoSummary } from "@/lib/eporner";
import { MAX_HISTORY, STORAGE_KEYS } from "@/lib/storage-keys";
import { useStoredList } from "@/lib/use-stored-list";

/**
 * Records the current video into watch history. Renders nothing.
 *
 * Writing to localStorage is a side effect on an external store, which is what
 * useEffect is actually for — unlike the setState-in-effect pattern the lint
 * rules reject.
 */
export default function WatchHistoryRecorder({ video }: { video: VideoSummary }) {
  const { add } = useStoredList<VideoSummary>(STORAGE_KEYS.history, MAX_HISTORY);
  const recordedId = useRef<string | null>(null);

  useEffect(() => {
    // Guard against re-recording on every re-render of the same video, which
    // would otherwise churn the list on each parent update.
    if (recordedId.current === video.id) return;
    recordedId.current = video.id;
    add(toVideoSummary(video));
  }, [video, add]);

  return null;
}
