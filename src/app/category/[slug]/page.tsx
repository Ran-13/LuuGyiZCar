import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import InfiniteVideoGrid from "@/components/InfiniteVideoGrid";
import SectionHeading from "@/components/SectionHeading";
import SortTabs from "@/components/SortTabs";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { DEFAULT_ORDER, isSortOrder, searchVideos } from "@/lib/eporner";

export const revalidate = 900;

/** Videos fetched per infinite-scroll batch. */
const BATCH_SIZE = 24;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ order?: string }>;
}

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) return { title: "Not found" };

  return { title: `${category.label} Videos`, description: category.description };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { order: rawOrder } = await searchParams;

  const category = getCategory(slug);
  if (!category) notFound();

  const order = isSortOrder(rawOrder) ? rawOrder : DEFAULT_ORDER;

  const result = await searchVideos({ query: category.query, perPage: BATCH_SIZE, order });

  const subtitle =
    result.totalCount > 0
      ? `${result.totalCount.toLocaleString()} videos`
      : category.description;

  return (
    <>
      <SectionHeading as="h1" title={`${category.label} Videos`} subtitle={subtitle} />

      <div className="mb-6">
        <SortTabs active={order} basePath={`/category/${category.slug}`} />
      </div>

      {result.failed ? (
        <EmptyState
          title="Could not load this category"
          message="The upstream API did not respond. Try again in a moment."
        />
      ) : result.videos.length === 0 ? (
        <EmptyState
          title="No videos found"
          message="This category returned nothing. Try a different sort or category."
        />
      ) : (
        <InfiniteVideoGrid
          // Remounts on sort change so the feed restarts instead of appending
          // a new ordering onto the old results.
          key={`${category.slug}-${order}`}
          initialVideos={result.videos}
          totalPages={result.totalPages}
          query={category.query}
          order={order}
          batchSize={BATCH_SIZE}
          priorityCount={6}
        />
      )}
    </>
  );
}
