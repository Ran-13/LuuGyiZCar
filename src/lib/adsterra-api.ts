/**
 * Adsterra Publisher API v3 client.
 * Docs: https://adsterra.com/blog/how-to-use-adsterra-publishers-api/
 * Base: https://api3.adsterratools.com/publisher/
 * Auth: X-API-Key header
 */

const API_BASE = "https://api3.adsterratools.com/publisher";
const REQUEST_TIMEOUT_MS = 20_000;

export type AdsterraGroupBy = "date" | "placement" | "country" | "domain";

export type AdsterraStatRow = {
  date?: string;
  placement?: number;
  domain?: number;
  country?: string;
  impression: number;
  clicks: number;
  ctr: number;
  cpm: number;
  revenue: number;
};

export type AdsterraStatsResponse = {
  items: AdsterraStatRow[];
  itemCount: number;
  dbLastUpdateTime?: string;
  dbDateTime?: string;
};

export type AdsterraDomain = { id: number; title: string };
export type AdsterraPlacement = {
  id: number;
  domain_id: number;
  title: string;
  alias?: string;
};

export function resolveAdsterraApiKey(storedKey?: string | null): string {
  const fromEnv = process.env.ADSTERRA_API_KEY?.trim() ?? "";
  if (fromEnv) return fromEnv;
  return typeof storedKey === "string" ? storedKey.trim() : "";
}

async function adsterraGet<T>(
  path: string,
  apiKey: string,
  query?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${API_BASE}/${path.replace(/^\//, "")}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-API-Key": apiKey,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("Invalid or expired Adsterra API key");
  }
  if (!res.ok) {
    throw new Error(`Adsterra API error ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchAdsterraStats(
  apiKey: string,
  opts: {
    startDate: string;
    finishDate: string;
    groupBy?: AdsterraGroupBy;
    domainId?: string;
    placementId?: string;
  },
): Promise<AdsterraStatsResponse> {
  const query: Record<string, string> = {
    start_date: opts.startDate,
    finish_date: opts.finishDate,
  };
  if (opts.groupBy) query.group_by = opts.groupBy;
  if (opts.domainId) query.domain = opts.domainId;
  if (opts.placementId) query.placement = opts.placementId;

  return adsterraGet<AdsterraStatsResponse>("stats.json", apiKey, query);
}

export async function fetchAdsterraDomains(apiKey: string): Promise<AdsterraDomain[]> {
  const data = await adsterraGet<{ items?: AdsterraDomain[] }>("domains.json", apiKey);
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchAdsterraPlacements(apiKey: string): Promise<AdsterraPlacement[]> {
  const data = await adsterraGet<{ items?: AdsterraPlacement[] }>("placements.json", apiKey);
  return Array.isArray(data.items) ? data.items : [];
}

export function sumStats(items: AdsterraStatRow[]) {
  return items.reduce(
    (acc, row) => {
      acc.impression += Number(row.impression) || 0;
      acc.clicks += Number(row.clicks) || 0;
      acc.revenue += Number(row.revenue) || 0;
      return acc;
    },
    { impression: 0, clicks: 0, revenue: 0 },
  );
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(n);
}

export function formatInt(n: number): string {
  return new Intl.NumberFormat("en").format(Math.round(n));
}

/** YYYY-MM-DD in UTC */
export function isoDateUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysAgoUTC(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return isoDateUTC(d);
}

/** Normalize host for Adsterra domain matching (strip www / port / path). */
export function normalizeHost(value: string): string {
  let s = value.trim().toLowerCase();
  if (!s) return "";
  try {
    if (s.includes("://")) s = new URL(s).hostname;
  } catch {
    /* keep raw */
  }
  s = s.replace(/^www\./, "").split("/")[0]?.split(":")[0] ?? "";
  return s;
}

/**
 * Pick the Adsterra domain id for this deployment.
 * Prefer an explicit id; otherwise match SITE_URL / hostname
 * against Adsterra website titles (e.g. luugyizcar.site).
 * Ignores Smartlink placeholders (smart-link-*).
 */
export function resolveAdsterraDomainId(
  domains: AdsterraDomain[],
  opts: {
    explicitId?: string | null;
    siteUrl?: string | null;
    hostname?: string | null;
    siteName?: string | null;
  },
): { id: string; title: string; source: "explicit" | "host" | "name" | "" } {
  if (domains.length === 0) return { id: "", title: "", source: "" };

  const isSmartLink = (title: string) => /^smart-?link/i.test(title.trim());
  const realDomains = domains.filter((d) => !isSmartLink(d.title));
  const pool = realDomains.length > 0 ? realDomains : domains;

  const explicit = (opts.explicitId ?? "").trim();
  if (/^\d+$/.test(explicit)) {
    const hit = domains.find((d) => String(d.id) === explicit);
    if (hit) return { id: String(hit.id), title: hit.title, source: "explicit" };
  }

  // Prefer configured site URL over request host (admin may be on IP / localhost).
  const hosts = [
    normalizeHost(opts.siteUrl ?? ""),
    normalizeHost(opts.hostname ?? ""),
  ].filter((h) => h && h !== "localhost" && !/^\d{1,3}(\.\d{1,3}){3}$/.test(h));

  for (const host of hosts) {
    const exact = pool.find((d) => normalizeHost(d.title) === host);
    if (exact) return { id: String(exact.id), title: exact.title, source: "host" };

    const hostBase = (host.split(".")[0] || host).replace(/[^a-z0-9]/g, "");
    if (hostBase.length < 3) continue;

    const partial = pool.find((d) => {
      const t = normalizeHost(d.title);
      if (!t.includes(".")) return false; // require real hostname titles
      const base = (t.split(".")[0] || "").replace(/[^a-z0-9]/g, "");
      return base === hostBase;
    });
    if (partial) return { id: String(partial.id), title: partial.title, source: "host" };
  }

  const name = (opts.siteName ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  if (name.length >= 4) {
    const byName = pool.find((d) => {
      const t = normalizeHost(d.title);
      if (!t.includes(".")) return false;
      const base = (t.split(".")[0] || "").replace(/[^a-z0-9]/g, "");
      return base === name || base.includes(name) || name.includes(base);
    });
    if (byName) return { id: String(byName.id), title: byName.title, source: "name" };
  }

  return { id: "", title: "", source: "" };
}
