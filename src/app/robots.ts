import type { MetadataRoute } from "next";
import { ADMIN_UI_PATH } from "@/lib/admin-path";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /api is machine-only; /search results are thin duplicate content.
      // Secret admin UI must never be crawled.
      disallow: ["/api/", "/search", "/admin", ADMIN_UI_PATH],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
