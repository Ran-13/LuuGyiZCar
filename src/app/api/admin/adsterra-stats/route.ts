import { NextResponse } from "next/server";
import { readAdsConfig } from "@/lib/ads";
import { requireAdminApi } from "@/lib/admin-guard";
import {
  daysAgoUTC,
  fetchAdsterraDomains,
  fetchAdsterraPlacements,
  fetchAdsterraStats,
  isoDateUTC,
  resolveAdsterraApiKey,
  resolveAdsterraDomainId,
  sumStats,
  type AdsterraGroupBy,
} from "@/lib/adsterra-api";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";

const GROUP_BY: AdsterraGroupBy[] = ["date", "placement", "country", "domain"];

/**
 * Admin-only Adsterra Publisher stats proxy.
 * Always scoped to this site’s Adsterra domain (SITE_URL / saved statsDomainId).
 */
export async function GET(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;

  const ads = await readAdsConfig();
  const apiKey = resolveAdsterraApiKey(ads.adsterra?.apiKey);
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Adsterra API key not configured",
        code: "NO_API_KEY",
        hint: "Set ADSTERRA_API_KEY in .env or paste the key in Admin → Adsterra",
      },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "7";
  const groupRaw = (searchParams.get("group_by") || "date") as AdsterraGroupBy;
  const groupBy = GROUP_BY.includes(groupRaw) ? groupRaw : "date";
  const domainParam = (searchParams.get("domain") || "").trim();

  let startDate = searchParams.get("start_date") || "";
  let finishDate = searchParams.get("finish_date") || "";

  if (!startDate || !finishDate) {
    finishDate = isoDateUTC(new Date());
    if (range === "1" || range === "today") {
      startDate = finishDate;
    } else if (range === "30") {
      startDate = daysAgoUTC(29);
    } else {
      startDate = daysAgoUTC(6);
    }
  }

  try {
    const [domains, placements] = await Promise.all([
      fetchAdsterraDomains(apiKey).catch(() => []),
      fetchAdsterraPlacements(apiKey).catch(() => []),
    ]);

    const requestHost = (() => {
      try {
        return new URL(request.headers.get("referer") || request.url).hostname;
      } catch {
        return "";
      }
    })();

    const resolved = resolveAdsterraDomainId(domains, {
      explicitId: ads.adsterra?.statsDomainId,
      siteUrl: SITE_URL,
      hostname: requestHost,
      siteName: ads.site?.siteName,
    });

    // Always scope to this site’s domain — never account-wide from the UI.
    let domainId: string | undefined;
    if (/^\d+$/.test(domainParam) && domainParam !== "all") {
      domainId = domainParam;
    } else if (resolved.id) {
      domainId = resolved.id;
    }

    if (!domainId) {
      const websiteDomains = domains.filter(
        (d) => /\./.test(d.title) && !/^smart-?link/i.test(d.title),
      );
      return NextResponse.json(
        {
          ok: false,
          error: "Could not resolve Adsterra website for this site",
          code: "NO_DOMAIN",
          hint: "Set Stats website under Admin → Adsterra, or set NEXT_PUBLIC_SITE_URL to match luugyizcar.site / akogyivip.site",
          domains: websiteDomains,
          autoDomainId: null,
          autoDomainTitle: null,
          siteUrl: SITE_URL,
        },
        { status: 400 },
      );
    }

    const stats = await fetchAdsterraStats(apiKey, {
      startDate,
      finishDate,
      groupBy,
      domainId,
    });

    const totals = sumStats(stats.items ?? []);
    const ctr =
      totals.impression > 0 ? (totals.clicks / totals.impression) * 100 : 0;
    const cpm =
      totals.impression > 0 ? (totals.revenue / totals.impression) * 1000 : 0;

    const domainMap = Object.fromEntries(domains.map((d) => [d.id, d.title]));
    const sitePlacements = placements.filter((p) => String(p.domain_id) === domainId);
    const placementMap = Object.fromEntries(
      sitePlacements.map((p) => [p.id, p.title || p.alias || String(p.id)]),
    );
    const websiteDomains = domains.filter((d) => /\./.test(d.title) && !/^smart-?link/i.test(d.title));

    return NextResponse.json(
      {
        ok: true,
        startDate,
        finishDate,
        groupBy,
        domainId,
        autoDomainId: resolved.id || domainId,
        autoDomainTitle: resolved.title || domainMap[domainId] || null,
        autoSource: resolved.source || null,
        siteUrl: SITE_URL,
        totals: {
          impression: totals.impression,
          clicks: totals.clicks,
          revenue: totals.revenue,
          ctr,
          cpm,
        },
        items: stats.items ?? [],
        itemCount: stats.itemCount ?? stats.items?.length ?? 0,
        dbLastUpdateTime: stats.dbLastUpdateTime ?? null,
        domains: websiteDomains,
        placements: sitePlacements,
        domainMap,
        placementMap,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Adsterra request failed";
    console.error("[adsterra-stats]", message);
    return NextResponse.json({ error: message, code: "ADSTERRA_ERROR" }, { status: 502 });
  }
}
