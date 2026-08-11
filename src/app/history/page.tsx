import type { Metadata } from "next";
import SavedVideoList from "@/components/SavedVideoList";
import { readAdsConfig } from "@/lib/ads";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export const metadata: Metadata = {
  title: "Watch History",
  robots: { index: false, follow: false },
};

export default async function HistoryPage() {
  const ads = await readAdsConfig();
  return (
    <SavedVideoList
      storageKey={STORAGE_KEYS.history}
      title="Watch History"
      emptyMessage="Videos you watch will show up here."
      clearLabel="Clear history"
      columns={ads.feed.gridColumns === 1 ? 1 : 2}
    />
  );
}
