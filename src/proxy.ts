import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function adminSlug(): string {
  const raw =
    process.env.ADMIN_PATH?.trim() ||
    process.env.NEXT_PUBLIC_ADMIN_PATH?.trim() ||
    "admin";
  return (
    raw
      .replace(/^\/+|\/+$/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase() || "admin"
  );
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

/**
 * Hides `/admin` behind a secret slug from ADMIN_PATH.
 * Example: ADMIN_PATH=panel-k9x2m → public URL is /panel-k9x2m (rewrites to /admin).
 */
export function proxy(request: NextRequest) {
  const slug = adminSlug();
  const { pathname } = request.nextUrl;

  const isDefaultUi = pathname === "/admin" || pathname.startsWith("/admin/");
  const isDefaultApi = pathname === "/api/admin" || pathname.startsWith("/api/admin/");
  const isSecretUi = pathname === `/${slug}` || pathname.startsWith(`/${slug}/`);
  const isSecretApi =
    pathname === `/api/${slug}` || pathname.startsWith(`/api/${slug}/`);

  // When a custom slug is set, the obvious /admin URLs return 404.
  if (slug !== "admin" && (isDefaultUi || isDefaultApi)) {
    return withAdminHeaders(new NextResponse(null, { status: 404 }));
  }

  if (isSecretUi && slug !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(`/${slug}`, "/admin");
    return withAdminHeaders(NextResponse.rewrite(url));
  }

  if (isSecretApi && slug !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(`/api/${slug}`, "/api/admin");
    return withAdminHeaders(NextResponse.rewrite(url));
  }

  if (isDefaultUi || isDefaultApi || isSecretUi || isSecretApi) {
    return withAdminHeaders(NextResponse.next());
  }

  return NextResponse.next();
}

export const config = {
  // Broad enough to catch a custom ADMIN_PATH slug; logic above decides.
  matcher: ["/((?!_next/static|_next/image|uploads/|.*\\..*).*)"],
};
