import type { Metadata } from "next";
import SavedVideoList from "@/components/SavedVideoList";
import { readAdsConfig } from "@/lib/ads";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export const metadata: Metadata = {
  title: "Favorites",
  robots: { index: false, follow: false },
};

export default async function FavoritesPage() {
  const ads = await readAdsConfig();
  return (
    <SavedVideoList
      storageKey={STORAGE_KEYS.favorites}
      title="Favorites"
      emptyMessage="Tap the heart on any video to save it here."
      clearLabel="Clear all"
      columns={ads.feed.gridColumns === 1 ? 1 : 2}
    />
  );
}
