/**
 * Absolute origin of the deployed site.
 *
 * Required for canonical URLs, the sitemap, and Open Graph images — relative
 * image URLs are ignored by every social scraper. Set NEXT_PUBLIC_SITE_URL in
 * production; the localhost fallback only keeps local builds working.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export const SITE_NAME = "LuuGyi Zcar";

export const SITE_DESCRIPTION =
  "Browse and search HD videos across Korea, Japan, Asian, amateur and more categories.";

/** Builds an absolute URL for a site-relative path. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
