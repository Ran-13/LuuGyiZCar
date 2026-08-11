import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import ExoClickInterstitial from "@/components/ExoClickInterstitial";
import InfiniteVideoGrid from "@/components/InfiniteVideoGrid";
import SectionHeading from "@/components/SectionHeading";
import SortTabs from "@/components/SortTabs";
import { readAdsConfig } from "@/lib/ads";
import { DEFAULT_CATEGORIES, getCategoryFromList } from "@/lib/categories";
import { DEFAULT_ORDER, isSortOrder, searchVideos } from "@/lib/eporner";

export const revalidate = 900;
/** Allow admin-added category slugs that were not in the build-time list. */
export const dynamicParams = true;

/** Videos fetched per infinite-scroll batch. */
const BATCH_SIZE = 24;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ order?: string }>;
}

export function generateStaticParams() {
  return DEFAULT_CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const ads = await readAdsConfig();
  const category = getCategoryFromList(ads.feed.categories, slug);
  if (!category) return { title: "Not found" };

  const path = `/category/${category.slug}`;
  return {
    title: `${category.label} Videos`,
    description: category.description,
    alternates: { canonical: path },
    openGraph: {
      title: `${category.label} Videos`,
      description: category.description,
      url: path,
    },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { order: rawOrder } = await searchParams;

  const ads = await readAdsConfig();
  const category = getCategoryFromList(ads.feed.categories, slug);
  if (!category) notFound();

  const order = isSortOrder(rawOrder) ? rawOrder : DEFAULT_ORDER;

  const result = await searchVideos({
    query: category.query,
    perPage: BATCH_SIZE,
    order,
  });

  const subtitle =
    result.totalCount > 0
      ? `${result.totalCount.toLocaleString()} videos`
      : category.description;

  return (
    <>
      <ExoClickInterstitial network={ads.network} />

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
          key={`${category.slug}-${order}`}
          initialVideos={result.videos}
          totalPages={result.totalPages}
          query={category.query}
          order={order}
          batchSize={BATCH_SIZE}
          priorityCount={4}
          categories={ads.feed.categories}
        />
      )}
    </>
  );
}
