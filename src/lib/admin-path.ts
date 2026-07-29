/**
 * Secret admin URL slug (no leading slash).
 *
 * Set the same value for ADMIN_PATH (server rewrite) and NEXT_PUBLIC_ADMIN_PATH
 * (client fetch URLs + chrome hide). Default "admin" keeps local/dev simple;
 * production should use a long random slug.
 */
const RAW =
  process.env.NEXT_PUBLIC_ADMIN_PATH?.trim() ||
  process.env.ADMIN_PATH?.trim() ||
  "admin";

/** Normalized slug: lowercase, URL-safe, no slashes. */
export const ADMIN_PATH_SLUG = RAW.replace(/^\/+|\/+$/g, "")
  .replace(/[^a-zA-Z0-9._-]/g, "-")
  .replace(/-+/g, "-")
  .toLowerCase() || "admin";

/** Browser path for the admin UI, e.g. `/panel-k9x2m`. */
export const ADMIN_UI_PATH = `/${ADMIN_PATH_SLUG}`;

/** Browser path prefix for admin APIs, e.g. `/api/panel-k9x2m`. */
export const ADMIN_API_PREFIX = `/api/${ADMIN_PATH_SLUG}`;

export function isAdminUiPath(pathname: string): boolean {
  return pathname === ADMIN_UI_PATH || pathname.startsWith(`${ADMIN_UI_PATH}/`);
}

export function adminApiUrl(suffix: string): string {
  const path = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${ADMIN_API_PREFIX}${path}`;
}
