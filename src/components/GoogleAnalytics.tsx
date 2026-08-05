"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { isValidGaMeasurementId } from "@/lib/ads-types";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function pagePath(pathname: string, search: string): string {
  return search ? `${pathname}?${search}` : pathname;
}

function GaPageViews({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";

  useEffect(() => {
    if (!pathname) return;
    // Skip admin UI noise in reports.
    if (pathname === "/admin" || pathname.startsWith("/admin/")) return;
    if (typeof window.gtag !== "function") return;
    window.gtag("config", measurementId, {
      page_path: pagePath(pathname, search),
    });
  }, [measurementId, pathname, search]);

  return null;
}

/**
 * Google Analytics 4 — loads gtag.js and records SPA page views on route changes.
 */
export default function GoogleAnalytics({
  enabled,
  measurementId,
}: {
  enabled: boolean;
  measurementId: string;
}) {
  const id = measurementId.trim();
  if (!enabled || !isValidGaMeasurementId(id)) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', ${JSON.stringify(id)}, { send_page_view: false });
        `}
      </Script>
      <Suspense fallback={null}>
        <GaPageViews measurementId={id} />
      </Suspense>
    </>
  );
}
