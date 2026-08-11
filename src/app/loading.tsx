import GridSkeleton from "@/components/GridSkeleton";
import { readAdsConfig } from "@/lib/ads";

/** Shown while the home / trending page is loading. */
export default async function Loading() {
  const ads = await readAdsConfig();
  const columns = ads.feed.gridColumns === 1 ? 1 : 2;

  return (
    <>
      <div className="mb-6 flex gap-2 lg:hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-9 w-24 shrink-0 animate-pulse rounded-md bg-ink-850" />
        ))}
      </div>

      <div className="mb-6 h-20 animate-pulse rounded-lg bg-ink-900 sm:h-28" />

      <div className="mb-4">
        <div className="h-6 w-44 animate-pulse rounded bg-ink-800" />
        <div className="mt-2 h-3.5 w-56 animate-pulse rounded bg-ink-850" />
      </div>

      <GridSkeleton count={24} columns={columns} />
    </>
  );
}
