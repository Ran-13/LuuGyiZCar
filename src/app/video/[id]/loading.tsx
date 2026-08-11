import GridSkeleton from "@/components/GridSkeleton";
import { readAdsConfig } from "@/lib/ads";

export default async function Loading() {
  const ads = await readAdsConfig();
  const columns = ads.feed.gridColumns === 1 ? 1 : 2;

  return (
    <>
      <div>
        {/* Matches the player's max-width cap so the skeleton does not shift on load. */}
        <div className="mx-auto aspect-video w-full max-w-[calc(82vh*16/9)] animate-pulse rounded-lg bg-ink-800" />

        <div className="mt-4 h-5 w-3/4 animate-pulse rounded bg-ink-800 sm:w-1/2" />

        <div className="mt-3 flex gap-4 border-b border-ink-700 pb-4">
          <div className="h-3.5 w-20 animate-pulse rounded bg-ink-850" />
          <div className="h-3.5 w-12 animate-pulse rounded bg-ink-850" />
          <div className="h-3.5 w-24 animate-pulse rounded bg-ink-850" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-6 w-16 animate-pulse rounded-full bg-ink-850" />
          ))}
        </div>
      </div>

      <div className="mt-12">
        <div className="mb-4 h-6 w-40 animate-pulse rounded bg-ink-800" />
        <GridSkeleton count={12} columns={columns} />
      </div>
    </>
  );
}
