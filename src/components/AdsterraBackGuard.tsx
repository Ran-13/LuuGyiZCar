"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isAdminUiPath } from "@/lib/admin-path";

const MARK = "__adsterraBackGuard";

/**
 * Adsterra popunders often navigate the current tab to the advertiser
 * (`location = ad` / `location.replace`) or bury the site in another window.
 * Without a same-URL history entry created during a *user gesture*, Back can
 * skip the site entirely (Chromium history-manipulation intervention).
 *
 * We:
 * 1. On first pointer/key activation per path — pushState so Back from the ad
 *    returns here.
 * 2. After clicks — briefly reclaim window focus so the tube stays in front
 *    when the network opens a true pop*under*.
 */
export default function AdsterraBackGuard({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const active = Boolean(enabled && !isAdminUiPath(pathname));

  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    let armedForPath = "";

    const armHistory = () => {
      if (armedForPath === pathname) return;
      try {
        const prev =
          history.state && typeof history.state === "object"
            ? (history.state as Record<string, unknown>)
            : {};
        if (prev[MARK] === pathname) {
          armedForPath = pathname;
          return;
        }
        // Must run under user activation so Chrome does not mark this entry skippable.
        history.pushState({ ...prev, [MARK]: pathname }, "", location.href);
        armedForPath = pathname;
        sessionStorage.setItem("site:return", location.href);
      } catch {
        /* private mode / security errors */
      }
    };

    const onActivate = () => armHistory();

    // Capture phase runs before Adsterra's bubble handlers / redirect.
    document.addEventListener("pointerdown", onActivate, true);
    document.addEventListener("keydown", onActivate, true);

    // Keep this tab in front when the network opens an under-window.
    // Skip when the user is opening a video — don't fight navigation/focus.
    const onClick = (e: MouseEvent) => {
      const el = e.target;
      if (
        el instanceof Element &&
        el.closest('a[href^="/video/"], .exo-int-trigger')
      ) {
        return;
      }
      window.setTimeout(() => {
        try {
          window.focus();
        } catch {
          /* ignore */
        }
      }, 0);
    };
    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("pointerdown", onActivate, true);
      document.removeEventListener("keydown", onActivate, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [active, pathname]);

  return null;
}
