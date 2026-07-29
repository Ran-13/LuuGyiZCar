import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { normalizeAdminSlug } from "@/lib/admin-path";

function adminSlug(): string {
  const raw =
    process.env.ADMIN_PATH?.trim() ||
    process.env.NEXT_PUBLIC_ADMIN_PATH?.trim() ||
    "admin";
  return normalizeAdminSlug(raw);
}

function withAdminHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "no-store");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
  return response;
}

/** Case-insensitive prefix match (slug in .env may be mixed-case). */
function stripSecretPrefix(pathname: string, prefix: string): string | null {
  const p = pathname.toLowerCase();
  const pre = prefix.toLowerCase();
  if (p === pre) return "";
  if (p.startsWith(`${pre}/`)) return pathname.slice(prefix.length);
  return null;
}

/**
 * Hides `/admin` behind a secret slug from ADMIN_PATH.
 * Example: ADMIN_PATH=panel-k9x2m → public URL is /panel-k9x2m (rewrites to /admin).
 */
export function proxy(request: NextRequest) {
  const slug = adminSlug();
  const { pathname } = request.nextUrl;

  const secretUiRest = stripSecretPrefix(pathname, `/${slug}`);
  const secretApiRest = stripSecretPrefix(pathname, `/api/${slug}`);

  const isDefaultUi = pathname === "/admin" || pathname.startsWith("/admin/");
  const isDefaultApi = pathname === "/api/admin" || pathname.startsWith("/api/admin/");
  const isSecretUi = secretUiRest !== null;
  const isSecretApi = secretApiRest !== null;

  if (slug !== "admin" && (isDefaultUi || isDefaultApi)) {
    return withAdminHeaders(new NextResponse(null, { status: 404 }));
  }

  if (isSecretUi && slug !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = secretUiRest ? `/admin${secretUiRest}` : "/admin";
    return withAdminHeaders(NextResponse.rewrite(url));
  }

  if (isSecretApi && slug !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = secretApiRest ? `/api/admin${secretApiRest}` : "/api/admin";
    return withAdminHeaders(NextResponse.rewrite(url));
  }

  if (isDefaultUi || isDefaultApi || isSecretUi || isSecretApi) {
    return withAdminHeaders(NextResponse.next());
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|uploads/|.*\\..*).*)"],
};
