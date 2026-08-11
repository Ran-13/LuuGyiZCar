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
 * Defaults to this site’s Adsterra domain (per admin / SITE_URL).
 * Pass domain=all for account-wide, or domain=<id> to override.
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

    // Per-admin default: this site’s domain. domain=all → account total.
    let domainId: string | undefined;
    if (domainParam === "all") {
      domainId = undefined;
    } else if (/^\d+$/.test(domainParam)) {
      domainId = domainParam;
    } else if (resolved.id) {
      domainId = resolved.id;
    }

    const effectiveGroupBy: AdsterraGroupBy =
      !domainId && groupBy === "date" ? "domain" : groupBy;

    const stats = await fetchAdsterraStats(apiKey, {
      startDate,
      finishDate,
      groupBy: effectiveGroupBy,
      domainId,
    });

    const totals = sumStats(stats.items ?? []);
    const ctr =
      totals.impression > 0 ? (totals.clicks / totals.impression) * 100 : 0;
    const cpm =
      totals.impression > 0 ? (totals.revenue / totals.impression) * 1000 : 0;

    const domainMap = Object.fromEntries(domains.map((d) => [d.id, d.title]));
    const placementMap = Object.fromEntries(
      placements.map((p) => [p.id, p.title || p.alias || String(p.id)]),
    );

    return NextResponse.json(
      {
        ok: true,
        startDate,
        finishDate,
        groupBy: effectiveGroupBy,
        domainId: domainId || null,
        autoDomainId: resolved.id || null,
        autoDomainTitle: resolved.title || null,
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
        domains,
        placements,
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
