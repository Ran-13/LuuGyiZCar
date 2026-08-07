"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApiUrl } from "@/lib/admin-path";

interface DaySummary {
  date: string;
  pageViews: number;
  activeUsers: number;
  newUsers: number;
  topPaths: { path: string; views: number }[];
}

interface Overview {
  today: DaySummary;
  yesterday: DaySummary;
  last7Days: DaySummary[];
  last30Totals: {
    pageViews: number;
    activeUsersApprox: number;
    newUsers: number;
  };
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-md border border-ink-700 bg-ink-950 px-3 py-3">
      <p className="text-xs text-ink-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-ink-100">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-ink-500">{hint}</p> : null}
    </div>
  );
}

function formatInt(n: number): string {
  return new Intl.NumberFormat("en").format(n);
}

/**
 * First-party traffic dashboard — DAU, new users, page views from data on this VPS.
 * Built-in traffic dashboard — DAU, new users, page views from data on this VPS.
 */
export default function AdminAnalyticsPanel() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(adminApiUrl("/analytics"), { credentials: "same-origin" });
      if (!res.ok) throw new Error("Could not load analytics");
      setData((await res.json()) as Overview);
    } catch {
      setError("Failed to load site analytics.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const maxBar = Math.max(1, ...(data?.last7Days.map((d) => d.activeUsers) ?? [1]));

  return (
    <section className="rounded-lg border border-ink-700 bg-ink-900 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink-100">Site traffic</h2>
          <p className="mt-1 text-xs text-ink-400">
            Built-in analytics for this domain (no Google). Counts real browsers with an anonymous
            cookie — not ad-block proof, but good enough for DAU / new users / page views.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-300 hover:border-brand-500 hover:text-brand-500"
        >
          Refresh
        </button>
      </div>

      {loading && !data ? (
        <p className="mt-4 text-sm text-ink-400">Loading…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-400">{error}</p>
      ) : data ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Today — active users"
              value={formatInt(data.today.activeUsers)}
              hint="Unique visitors today (DAU)"
            />
            <StatCard
              label="Today — new users"
              value={formatInt(data.today.newUsers)}
              hint="First time on this site"
            />
            <StatCard
              label="Today — page views"
              value={formatInt(data.today.pageViews)}
            />
            <StatCard
              label="Yesterday — active users"
              value={formatInt(data.yesterday.activeUsers)}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Last 30 days — page views"
              value={formatInt(data.last30Totals.pageViews)}
            />
            <StatCard
              label="Last 30 days — unique visitors"
              value={formatInt(data.last30Totals.activeUsersApprox)}
              hint="Approx. distinct visitors"
            />
            <StatCard
              label="Last 30 days — new users"
              value={formatInt(data.last30Totals.newUsers)}
            />
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium text-ink-200">Last 7 days — active users</p>
            <div className="mt-3 flex items-end gap-2">
              {data.last7Days.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] tabular-nums text-ink-400">
                    {formatInt(d.activeUsers)}
                  </span>
                  <div
                    className="w-full rounded-sm bg-brand-500/80"
                    style={{
                      height: `${Math.max(4, Math.round((d.activeUsers / maxBar) * 80))}px`,
                    }}
                    title={`${d.date}: ${d.activeUsers} users, ${d.pageViews} views`}
                  />
                  <span className="text-[10px] text-ink-500">{d.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>

          {data.today.topPaths.length > 0 ? (
            <div className="mt-5">
              <p className="text-sm font-medium text-ink-200">Today — top pages</p>
              <ul className="mt-2 divide-y divide-ink-800 rounded-md border border-ink-800">
                {data.today.topPaths.map((row) => (
                  <li
                    key={row.path}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                  >
                    <span className="truncate text-ink-300">{row.path}</span>
                    <span className="shrink-0 tabular-nums text-ink-400">
                      {formatInt(row.views)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
