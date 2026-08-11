"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatInt, formatMoney } from "@/lib/adsterra-api";
import { adminApiUrl } from "@/lib/admin-path";

type GroupBy = "date" | "placement" | "country" | "domain";

interface DomainOption {
  id: number;
  title: string;
}

interface StatsPayload {
  ok?: boolean;
  error?: string;
  code?: string;
  hint?: string;
  startDate?: string;
  finishDate?: string;
  groupBy?: GroupBy;
  domainId?: string | null;
  autoDomainId?: string | null;
  autoDomainTitle?: string | null;
  autoSource?: string | null;
  siteUrl?: string;
  totals?: {
    impression: number;
    clicks: number;
    revenue: number;
    ctr: number;
    cpm: number;
  };
  items?: Array<{
    date?: string;
    placement?: number;
    domain?: number;
    country?: string;
    impression: number;
    clicks: number;
    ctr: number;
    cpm: number;
    revenue: number;
  }>;
  dbLastUpdateTime?: string | null;
  domainMap?: Record<string, string>;
  placementMap?: Record<string, string>;
  domains?: DomainOption[];
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-ink-700 bg-ink-950 px-3 py-3">
      <p className="text-xs text-ink-400">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-ink-100">{value}</p>
    </div>
  );
}

function rowLabel(
  row: NonNullable<StatsPayload["items"]>[number],
  groupBy: GroupBy,
  domainMap: Record<string, string>,
  placementMap: Record<string, string>,
): string {
  if (groupBy === "date") return row.date || "—";
  if (groupBy === "country") return row.country || "—";
  if (groupBy === "domain") {
    const id = row.domain;
    return id != null ? domainMap[String(id)] || String(id) : "—";
  }
  if (groupBy === "placement") {
    const id = row.placement;
    return id != null ? placementMap[String(id)] || String(id) : "—";
  }
  return "—";
}

/**
 * Each site admin defaults to that site’s Adsterra domain.
 * Use domain=all only for account-wide compare.
 */
export default function AdminAdsterraStats() {
  const [range, setRange] = useState<"1" | "7" | "30">("7");
  const [groupBy, setGroupBy] = useState<GroupBy>("date");
  /** "" = this site (auto); "all" = account; otherwise Adsterra domain id */
  const [domainScope, setDomainScope] = useState<string>("");
  const [domains, setDomains] = useState<DomainOption[]>([]);
  const [data, setData] = useState<StatsPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const domainList = domains.length > 0 ? domains : data?.domains ?? [];

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ range, group_by: groupBy });
      if (domainScope === "all") {
        params.set("domain", "all");
      } else if (/^\d+$/.test(domainScope)) {
        params.set("domain", domainScope);
      }
      // else: omit → API auto-scopes to this site’s domain

      const res = await fetch(`${adminApiUrl("/adsterra-stats")}?${params}`, {
        credentials: "same-origin",
      });
      const json = (await res.json()) as StatsPayload;
      if (!res.ok) {
        setError(json.hint ? `${json.error} — ${json.hint}` : json.error || "Failed to load");
        setData(null);
        return;
      }
      if (Array.isArray(json.domains) && json.domains.length > 0) {
        setDomains(json.domains);
      }
      setData(json);
    } catch {
      setError("Failed to load Adsterra stats");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range, groupBy, domainScope]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = data?.totals;
  const items = data?.items ?? [];
  const maxBar = Math.max(1, ...items.map((i) => Number(i.revenue) || 0));
  const domainMap = data?.domainMap ?? {};
  const placementMap = data?.placementMap ?? {};

  const activeDomainId = data?.domainId || data?.autoDomainId || "";
  const selectedTitle = useMemo(() => {
    if (domainScope === "all" || !activeDomainId) {
      return domainScope === "all"
        ? "All websites (account total)"
        : "This site (auto)";
    }
    return (
      data?.autoDomainTitle ||
      domainMap[activeDomainId] ||
      domainList.find((d) => String(d.id) === activeDomainId)?.title ||
      activeDomainId
    );
  }, [domainScope, activeDomainId, data?.autoDomainTitle, domainMap, domainList]);

  const selectThisSite = () => {
    setDomainScope("");
    setGroupBy("date");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-xs text-ink-400">
        Stats are scoped to{" "}
        <span className="font-medium text-ink-200">{selectedTitle}</span>
        {data?.autoDomainTitle && domainScope !== "all" ? (
          <>
            {" "}
            (matched for this admin
            {data.autoSource === "explicit" ? " via saved domain" : " via site URL"})
          </>
        ) : null}
        . Other sites’ admins show their own domain.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-ink-700 p-0.5">
          {(
            [
              ["1", "Today"],
              ["7", "7 days"],
              ["30", "30 days"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                range === value
                  ? "bg-ink-800 text-brand-500"
                  : "text-ink-400 hover:text-ink-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          className="rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-brand-500"
        >
          <option value="date">By date</option>
          <option value="placement">By placement</option>
          <option value="domain">By domain</option>
          <option value="country">By country</option>
        </select>

        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto rounded-md border border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-300 hover:border-brand-500 hover:text-brand-500"
        >
          Refresh
        </button>
      </div>

      {domainList.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={selectThisSite}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
              domainScope === "" ||
              (activeDomainId && domainScope === activeDomainId) ||
              (data?.autoDomainId && domainScope === data.autoDomainId)
                ? "border-brand-500 text-brand-500"
                : "border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-200"
            }`}
          >
            This site
            {data?.autoDomainTitle ? ` (${data.autoDomainTitle})` : ""}
          </button>
          <button
            type="button"
            onClick={() => {
              setDomainScope("all");
              setGroupBy("domain");
            }}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
              domainScope === "all"
                ? "border-brand-500 text-brand-500"
                : "border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-200"
            }`}
          >
            Compare all
          </button>
          {domainList.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setDomainScope(String(d.id));
                setGroupBy("date");
              }}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                domainScope === String(d.id)
                  ? "border-brand-500 text-brand-500"
                  : "border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-200"
              }`}
            >
              {d.title}
            </button>
          ))}
        </div>
      ) : null}

      {loading && !data ? (
        <p className="text-sm text-ink-400">Loading Adsterra stats…</p>
      ) : error ? (
        <p className="rounded-md border border-red-900/50 bg-ink-950 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      ) : totals ? (
        <>
          <p className="text-xs text-ink-500">
            Showing: <span className="text-ink-300">{selectedTitle}</span>
            {data?.startDate && data?.finishDate
              ? ` · ${data.startDate} → ${data.finishDate}`
              : ""}
            {data.dbLastUpdateTime ? ` · Adsterra updated ${data.dbLastUpdateTime}` : ""}
          </p>

          {!data?.autoDomainId && domainScope !== "all" ? (
            <p className="rounded-md border border-amber-900/40 bg-ink-950 px-3 py-2 text-xs text-amber-400">
              Could not auto-match this site to an Adsterra website. Set{" "}
              <strong>Stats website</strong> under Admin → Adsterra, or ensure{" "}
              <code className="text-ink-300">NEXT_PUBLIC_SITE_URL</code> matches the domain
              in Adsterra (e.g. https://luugyizcar.com).
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Revenue" value={formatMoney(totals.revenue)} />
            <StatCard label="Impressions" value={formatInt(totals.impression)} />
            <StatCard label="Clicks" value={formatInt(totals.clicks)} />
            <StatCard label="CTR" value={`${totals.ctr.toFixed(2)}%`} />
            <StatCard label="CPM" value={formatMoney(totals.cpm)} />
          </div>

          {domainScope === "all" && groupBy === "domain" && items.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((row) => {
                const label = rowLabel(row, "domain", domainMap, placementMap);
                return (
                  <button
                    key={row.domain ?? label}
                    type="button"
                    onClick={() => {
                      if (row.domain != null) {
                        setDomainScope(String(row.domain));
                        setGroupBy("date");
                      }
                    }}
                    className="rounded-lg border border-ink-700 bg-ink-900 p-4 text-left hover:border-brand-500"
                  >
                    <p className="text-sm font-semibold text-ink-100">{label}</p>
                    <p className="mt-2 text-lg font-bold tabular-nums text-brand-500">
                      {formatMoney(Number(row.revenue) || 0)}
                    </p>
                    <p className="mt-1 text-xs text-ink-400">
                      {formatInt(row.impression)} impr · {formatInt(row.clicks)} clicks · CPM{" "}
                      {formatMoney(Number(row.cpm) || 0)}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : null}

          {groupBy === "date" && items.length > 0 ? (
            <div className="rounded-lg border border-ink-700 bg-ink-900 p-4">
              <p className="text-sm font-medium text-ink-200">Revenue by day</p>
              <div className="mt-3 flex items-end gap-1.5 sm:gap-2">
                {items.map((row) => {
                  const rev = Number(row.revenue) || 0;
                  return (
                    <div
                      key={row.date || Math.random()}
                      className="flex flex-1 flex-col items-center gap-1"
                    >
                      <span className="text-[10px] tabular-nums text-ink-400">
                        {rev > 0 ? formatMoney(rev) : ""}
                      </span>
                      <div
                        className="w-full rounded-sm bg-brand-500/80"
                        style={{
                          height: `${Math.max(4, Math.round((rev / maxBar) * 80))}px`,
                        }}
                        title={`${row.date}: ${formatMoney(rev)}`}
                      />
                      <span className="text-[10px] text-ink-500">
                        {(row.date || "").slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-ink-700">
            <table className="w-full min-w-lg text-left text-xs">
              <thead className="border-b border-ink-700 bg-ink-900 text-ink-400">
                <tr>
                  <th className="px-3 py-2 font-medium">
                    {groupBy === "date"
                      ? "Date"
                      : groupBy === "placement"
                        ? "Placement"
                        : groupBy === "domain"
                          ? "Domain"
                          : "Country"}
                  </th>
                  <th className="px-3 py-2 font-medium">Impr.</th>
                  <th className="px-3 py-2 font-medium">Clicks</th>
                  <th className="px-3 py-2 font-medium">CTR</th>
                  <th className="px-3 py-2 font-medium">CPM</th>
                  <th className="px-3 py-2 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-ink-500">
                      No stats in this range
                    </td>
                  </tr>
                ) : (
                  items.map((row, i) => (
                    <tr key={i} className="text-ink-300">
                      <td className="px-3 py-2 text-ink-100">
                        {rowLabel(row, groupBy, domainMap, placementMap)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatInt(row.impression)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatInt(row.clicks)}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {(Number(row.ctr) || 0).toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatMoney(Number(row.cpm) || 0)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-brand-500">
                        {formatMoney(Number(row.revenue) || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
