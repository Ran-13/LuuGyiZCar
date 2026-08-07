"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { isAdminUiPath } from "@/lib/admin-path";

function Beacon() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";

  useEffect(() => {
    if (!pathname || isAdminUiPath(pathname)) return;

    const path = search ? `${pathname}?${search}` : pathname;
    const body = JSON.stringify({ path });

    // prefer sendBeacon so navigations still flush
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/collect", blob);
      return;
    }

    void fetch("/api/analytics/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => {});
  }, [pathname, search]);

  return null;
}

/** Anonymous first-party pageview tracker (no Google). */
export default function SiteAnalytics() {
  return (
    <Suspense fallback={null}>
      <Beacon />
    </Suspense>
  );
}
