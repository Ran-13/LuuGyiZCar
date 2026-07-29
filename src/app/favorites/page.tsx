import type { Metadata } from "next";
import SavedVideoList from "@/components/SavedVideoList";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export const metadata: Metadata = {
  title: "Favorites",
  // Personal, device-local content — nothing for a crawler to index.
  robots: { index: false, follow: false },
};

export default function FavoritesPage() {
  return (
    <SavedVideoList
      storageKey={STORAGE_KEYS.favorites}
      title="Favorites"
      emptyMessage="Tap the heart on any video to save it here."
      clearLabel="Clear all"
    />
  );
}
