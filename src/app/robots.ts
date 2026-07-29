import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /api is machine-only; /search results are thin duplicate content.
      disallow: ["/api/", "/search"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
