import type { Metadata } from "next";
import SavedVideoList from "@/components/SavedVideoList";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export const metadata: Metadata = {
  title: "Watch History",
  // Personal, device-local content — nothing for a crawler to index.
  robots: { index: false, follow: false },
};

export default function HistoryPage() {
  return (
    <SavedVideoList
      storageKey={STORAGE_KEYS.history}
      title="Watch History"
      emptyMessage="Videos you watch will show up here."
      clearLabel="Clear history"
    />
  );
}
