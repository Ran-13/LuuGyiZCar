/**
 * Secret admin URL slug (no leading slash).
 * Case-sensitive — must match ADMIN_PATH in .env exactly (do not lowercase).
 */
const RAW =
  process.env.NEXT_PUBLIC_ADMIN_PATH?.trim() ||
  process.env.ADMIN_PATH?.trim() ||
  "admin";

export function normalizeAdminSlug(raw: string): string {
  return (
    raw
      .replace(/^\/+|\/+$/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-") || "admin"
  );
}

export const ADMIN_PATH_SLUG = normalizeAdminSlug(RAW);

/** Browser path for the admin UI, e.g. `/Mhn6H0ZxtsxTvE`. */
export const ADMIN_UI_PATH = `/${ADMIN_PATH_SLUG}`;

/** Browser path prefix for admin APIs. */
export const ADMIN_API_PREFIX = `/api/${ADMIN_PATH_SLUG}`;

export function isAdminUiPath(pathname: string): boolean {
  const p = pathname.toLowerCase();
  const slug = ADMIN_PATH_SLUG.toLowerCase();
  return p === `/${slug}` || p.startsWith(`/${slug}/`);
}

export function adminApiUrl(suffix: string): string {
  const path = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${ADMIN_API_PREFIX}${path}`;
}
