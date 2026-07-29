import GridSkeleton from "@/components/GridSkeleton";

export default function Loading() {
  return (
    <>
      <div className="mb-2 h-6 w-52 animate-pulse rounded bg-ink-800" />
      <div className="mb-5 h-3.5 w-64 animate-pulse rounded bg-ink-850" />
      <div className="mb-6 flex gap-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-9 w-24 animate-pulse rounded-md bg-ink-850" />
        ))}
      </div>
      <GridSkeleton />
    </>
  );
}
