"use client";

import { useCallback, useEffect, useState } from "react";
import { formatInt, formatMoney } from "@/lib/adsterra-api";
import { adminApiUrl } from "@/lib/admin-path";

type GroupBy = "date" | "placement" | "country" | "domain";

interface StatsPayload {
  ok?: boolean;
  error?: string;
  code?: string;
  hint?: string;
  startDate?: string;
  finishDate?: string;
  groupBy?: GroupBy;
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
  domains?: { id: number; title: string }[];
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

export default function AdminAdsterraStats() {
  const [range, setRange] = useState<"1" | "7" | "30">("7");
  const [groupBy, setGroupBy] = useState<GroupBy>("date");
  const [data, setData] = useState<StatsPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ range, group_by: groupBy });
      const res = await fetch(`${adminApiUrl("/adsterra-stats")}?${params}`, {
        credentials: "same-origin",
      });
      const json = (await res.json()) as StatsPayload;
      if (!res.ok) {
        setError(json.hint ? `${json.error} — ${json.hint}` : json.error || "Failed to load");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError("Failed to load Adsterra stats");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range, groupBy]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = data?.totals;
  const items = data?.items ?? [];
  const maxBar = Math.max(1, ...items.map((i) => Number(i.revenue) || 0));
  const domainMap = data?.domainMap ?? {};
  const placementMap = data?.placementMap ?? {};

  return (
    <div className="space-y-4">
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

      {loading && !data ? (
        <p className="text-sm text-ink-400">Loading Adsterra stats…</p>
      ) : error ? (
        <p className="rounded-md border border-red-900/50 bg-ink-950 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      ) : totals ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Revenue" value={formatMoney(totals.revenue)} />
            <StatCard label="Impressions" value={formatInt(totals.impression)} />
            <StatCard label="Clicks" value={formatInt(totals.clicks)} />
            <StatCard label="CTR" value={`${totals.ctr.toFixed(2)}%`} />
            <StatCard label="CPM" value={formatMoney(totals.cpm)} />
          </div>

          {data?.startDate && data?.finishDate ? (
            <p className="text-xs text-ink-500">
              {data.startDate} → {data.finishDate}
              {data.dbLastUpdateTime ? ` · Adsterra updated ${data.dbLastUpdateTime}` : ""}
            </p>
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
            <table className="w-full min-w-[32rem] text-left text-xs">
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
