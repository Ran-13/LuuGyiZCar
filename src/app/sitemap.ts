import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/categories";
import { searchVideos } from "@/lib/eporner";
import { absoluteUrl } from "@/lib/site";

/** Regenerate daily — the catalog moves, but not fast enough to warrant more. */
export const revalidate = 86_400;

/** Videos listed per category. Bounded so the sitemap stays well under the 50k URL limit. */
const VIDEOS_PER_CATEGORY = 24;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "hourly", priority: 1 },
    ...CATEGORIES.map((category) => ({
      url: absoluteUrl(`/category/${category.slug}`),
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];

  // One upstream call per category. searchVideos already swallows failures and
  // times out at 10s, so a flaky upstream degrades the sitemap instead of
  // failing the whole route.
  const results = await Promise.all(
    CATEGORIES.map((category) =>
      searchVideos({
        query: category.query,
        perPage: VIDEOS_PER_CATEGORY,
        order: "top-weekly",
      }),
    ),
  );

  const seen = new Set<string>();
  const videoRoutes: MetadataRoute.Sitemap = [];

  for (const result of results) {
    for (const video of result.videos) {
      if (seen.has(video.id)) continue;
      seen.add(video.id);
      videoRoutes.push({
        url: absoluteUrl(`/video/${video.id}`),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  return [...staticRoutes, ...videoRoutes];
}
