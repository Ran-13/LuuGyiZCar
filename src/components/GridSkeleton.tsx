export default function GridSkeleton({ count = 15 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-4 sm:gap-y-6 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-video rounded-md bg-ink-800" />
          <div className="mt-2 h-3 w-11/12 rounded bg-ink-800" />
          <div className="mt-1.5 h-3 w-2/3 rounded bg-ink-800" />
          <div className="mt-2.5 h-[3px] w-full rounded-full bg-ink-800" />
          <div className="mt-1.5 h-2.5 w-1/3 rounded bg-ink-850" />
        </div>
      ))}
    </div>
  );
}
