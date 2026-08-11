import { videoGridClassName } from "@/lib/video-grid";

export default function GridSkeleton({
  count = 15,
  columns = 2,
}: {
  count?: number;
  columns?: 1 | 2;
}) {
  return (
    <div className={videoGridClassName(columns)}>
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
