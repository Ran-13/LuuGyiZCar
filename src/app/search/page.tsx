import type { Metadata } from "next";
import EmptyState from "@/components/EmptyState";
import InfiniteVideoGrid from "@/components/InfiniteVideoGrid";
import SectionHeading from "@/components/SectionHeading";
import SortTabs from "@/components/SortTabs";
import { DEFAULT_ORDER, isSortOrder, searchVideos } from "@/lib/eporner";

export const revalidate = 900;

/** Videos fetched per infinite-scroll batch. */
const BATCH_SIZE = 24;

interface PageProps {
  searchParams: Promise<{ q?: string; order?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `"${q}" — Search` : "Search" };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q, order: rawOrder } = await searchParams;
  const query = (q ?? "").trim();

  if (!query) {
    return (
      <EmptyState title="Search for something" message="Enter a keyword in the bar above to start." />
    );
  }

  const order = isSortOrder(rawOrder) ? rawOrder : DEFAULT_ORDER;
  const result = await searchVideos({ query, perPage: BATCH_SIZE, order });

  return (
    <>
      <SectionHeading
        as="h1"
        title={`Results for “${query}”`}
        subtitle={result.totalCount > 0 ? `${result.totalCount.toLocaleString()} videos` : undefined}
      />

      <div className="mb-6">
        <SortTabs active={order} basePath="/search" params={{ q: query }} />
      </div>

      {result.failed ? (
        <EmptyState
          title="Search failed"
          message="The upstream API did not respond. Try again in a moment."
        />
      ) : result.videos.length === 0 ? (
        <EmptyState
          title="No videos found"
          message={`Nothing matched "${query}". Try a different keyword.`}
        />
      ) : (
        <InfiniteVideoGrid
          // Remounts on a new query or sort so the feed restarts cleanly.
          key={`${query}-${order}`}
          initialVideos={result.videos}
          totalPages={result.totalPages}
          query={query}
          order={order}
          batchSize={BATCH_SIZE}
          priorityCount={6}
        />
      )}
    </>
  );
}
