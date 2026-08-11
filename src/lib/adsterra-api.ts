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
