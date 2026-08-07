/**
 * First-party site analytics (no Google).
 *
 * Stored under data/analytics/ on the site volume. Tracks page views, daily
 * active users (unique visitors), and new users (first-seen cookie).
 */

import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";

const ROOT = path.join(process.cwd(), "data", "analytics");
const DAYS_DIR = path.join(ROOT, "days");
const FIRST_SEEN_FILE = path.join(ROOT, "first-seen.json");

const COOKIE_NAME = "sid";
const VISITOR_RETENTION_DAYS = 90;
const KEEP_DAY_FILES = 90;

/** Serialize disk writes so concurrent pageviews on one process don't clobber. */
let writeChain: Promise<void> = Promise.resolve();

function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export { COOKIE_NAME };

export interface DayStats {
  date: string;
  pageViews: number;
  /** Unique visitor ids (hashed) seen that day. */
  visitors: string[];
  newUsers: number;
  paths: Record<string, number>;
}

export interface DaySummary {
  date: string;
  pageViews: number;
  activeUsers: number;
  newUsers: number;
  topPaths: { path: string; views: number }[];
}

export interface AnalyticsOverview {
  today: DaySummary;
  yesterday: DaySummary;
  last7Days: DaySummary[];
  last30Totals: {
    pageViews: number;
    activeUsersApprox: number;
    newUsers: number;
  };
}

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function hashVisitor(id: string): string {
  return createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function emptyDay(date: string): DayStats {
  return { date, pageViews: 0, visitors: [], newUsers: 0, paths: {} };
}

async function ensureDirs(): Promise<void> {
  await mkdir(DAYS_DIR, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  await ensureDirs();
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(data), "utf8");
  await rename(tmp, file);
}

function dayFile(date: string): string {
  return path.join(DAYS_DIR, `${date}.json`);
}

async function loadDay(date: string): Promise<DayStats> {
  const raw = await readJson<Partial<DayStats>>(dayFile(date), {});
  return {
    date,
    pageViews: Number(raw.pageViews) || 0,
    visitors: Array.isArray(raw.visitors) ? raw.visitors.map(String) : [],
    newUsers: Number(raw.newUsers) || 0,
    paths: raw.paths && typeof raw.paths === "object" ? { ...raw.paths } : {},
  };
}

function toSummary(day: DayStats): DaySummary {
  const topPaths = Object.entries(day.paths)
    .map(([p, views]) => ({ path: p, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);
  return {
    date: day.date,
    pageViews: day.pageViews,
    activeUsers: day.visitors.length,
    newUsers: day.newUsers,
    topPaths,
  };
}

function normalizePath(raw: string): string {
  try {
    const u = new URL(raw, "https://example.com");
    let p = u.pathname || "/";
    if (p.length > 200) p = p.slice(0, 200);
    return p;
  } catch {
    return "/";
  }
}

export function isBotUserAgent(ua: string | null): boolean {
  if (!ua) return true;
  return /bot|crawl|spider|slurp|facebookexternalhit|preview|wget|curl|python-requests|headless/i.test(
    ua,
  );
}

export function newVisitorId(): string {
  return randomUUID();
}

/**
 * Record one page view. Returns whether the visitor was new to the site.
 */
export async function recordPageView(opts: {
  visitorId: string;
  path: string;
  isAdminPath: boolean;
}): Promise<{ ok: boolean; isNew: boolean }> {
  if (opts.isAdminPath) return { ok: false, isNew: false };

  const pathName = normalizePath(opts.path);
  if (
    pathName.startsWith("/_next") ||
    pathName.startsWith("/api/") ||
    pathName === "/vpn-required"
  ) {
    return { ok: false, isNew: false };
  }

  return enqueueWrite(async () => {
    const vid = hashVisitor(opts.visitorId);
    const today = dayKey();

    await ensureDirs();
    const day = await loadDay(today);
    day.pageViews += 1;
    day.paths[pathName] = (day.paths[pathName] ?? 0) + 1;

    const seenToday = new Set(day.visitors);
    if (!seenToday.has(vid)) {
      day.visitors.push(vid);
    }

    const firstSeen = await readJson<Record<string, string>>(FIRST_SEEN_FILE, {});
    let isNew = false;
    if (!firstSeen[vid]) {
      firstSeen[vid] = today;
      day.newUsers += 1;
      isNew = true;

      if (Object.keys(firstSeen).length % 200 === 0) {
        pruneFirstSeen(firstSeen, today);
      }
      await writeJsonAtomic(FIRST_SEEN_FILE, firstSeen);
    }

    await writeJsonAtomic(dayFile(today), day);
    return { ok: true, isNew };
  });
}

function pruneFirstSeen(map: Record<string, string>, today: string): void {
  const cutoff = new Date(`${today}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - VISITOR_RETENTION_DAYS);
  const cut = cutoff.toISOString().slice(0, 10);
  for (const [id, date] of Object.entries(map)) {
    if (date < cut) delete map[id];
  }
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const todayKey = dayKey();
  const yesterdayKey = shiftDate(todayKey, -1);

  const last7: DaySummary[] = [];
  for (let i = 6; i >= 0; i--) {
    const key = shiftDate(todayKey, -i);
    last7.push(toSummary(await loadDay(key)));
  }

  let pageViews30 = 0;
  let newUsers30 = 0;
  const uniq30 = new Set<string>();
  for (let i = 0; i < 30; i++) {
    const day = await loadDay(shiftDate(todayKey, -i));
    pageViews30 += day.pageViews;
    newUsers30 += day.newUsers;
    for (const v of day.visitors) uniq30.add(v);
  }

  return {
    today: toSummary(await loadDay(todayKey)),
    yesterday: toSummary(await loadDay(yesterdayKey)),
    last7Days: last7,
    last30Totals: {
      pageViews: pageViews30,
      activeUsersApprox: uniq30.size,
      newUsers: newUsers30,
    },
  };
}

/** Drop day files older than KEEP_DAY_FILES (best-effort). */
export async function pruneOldDayFiles(): Promise<void> {
  try {
    const { readdir, unlink } = await import("fs/promises");
    const files = await readdir(DAYS_DIR);
    const cutoff = shiftDate(dayKey(), -KEEP_DAY_FILES);
    for (const f of files) {
      if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) continue;
      const date = f.slice(0, 10);
      if (date < cutoff) await unlink(path.join(DAYS_DIR, f)).catch(() => {});
    }
  } catch {
    // ignore
  }
}
