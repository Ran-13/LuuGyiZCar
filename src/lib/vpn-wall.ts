/**
 * Myanmar (etc.) VPN wall — country gate helpers for `proxy.ts`.
 *
 * Proxy runs on the Node.js runtime, so we read the wall config from the
 * mounted volume (no self-HTTP fetch — that often fails inside Docker and
 * silently left the wall disabled).
 */

import { readFile } from "fs/promises";
import path from "path";

const GEO_TTL_MS = 60 * 60 * 1000;
const CONFIG_TTL_MS = 10_000;

interface GeoCacheEntry {
  country: string;
  expiresAt: number;
}

interface ConfigCacheEntry {
  enabled: boolean;
  blockedCountries: string[];
  expiresAt: number;
}

const geoCache = new Map<string, GeoCacheEntry>();
let configCache: ConfigCacheEntry | null = null;

const DATA_VPN_WALL = path.join(process.cwd(), "data", "vpn-wall.json");
const UPLOADS_VPN_WALL = path.join(process.cwd(), "public", "uploads", "vpn-wall.json");
const ADS_JSON = path.join(process.cwd(), "data", "ads.json");

function normalizeCountryCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

/**
 * Client IP for the VPN wall.
 *
 * Always prefers nginx's X-Real-IP / X-Forwarded-For. Without them the wall
 * cannot see Myanmar vs foreign exits and would fail-open forever. Rate
 * limiting stays on TRUST_PROXY_HEADERS; this feature is useless without IP.
 */
export function getRequestIp(headers: Headers): string | null {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = headers.get("x-forwarded-for");
  const clientIp = forwarded?.split(",")[0]?.trim();
  if (clientIp) return clientIp;

  // Local / direct Node (no nginx): allow opting into TRUST_PROXY only.
  if (process.env.TRUST_PROXY_HEADERS === "true") {
    return null;
  }
  return null;
}

function isNonPublicIp(ip: string): boolean {
  if (ip === "unknown" || ip === "127.0.0.1" || ip === "::1") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  return false;
}

async function fetchCountryFromProvider(ip: string): Promise<string> {
  // Primary
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(2500),
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as { success?: boolean; country_code?: string };
      if (data.success !== false) {
        const code = normalizeCountryCode(data.country_code);
        if (code) return code;
      }
    }
  } catch {
    // fall through
  }

  // Fallback — simple country-only API
  try {
    const res = await fetch(`https://api.country.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(2500),
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as { country?: string };
      const code = normalizeCountryCode(data.country);
      if (code) return code;
    }
  } catch {
    // fall through
  }

  return "";
}

/** ISO country code, or "" when unknown (caller fails open). */
export async function lookupCountryCode(ip: string | null): Promise<string> {
  if (!ip || isNonPublicIp(ip)) return "";

  const cached = geoCache.get(ip);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.country;

  const country = await fetchCountryFromProvider(ip);
  geoCache.set(ip, { country, expiresAt: now + GEO_TTL_MS });
  if (geoCache.size > 5000) {
    const first = geoCache.keys().next().value;
    if (first) geoCache.delete(first);
  }
  return country;
}

function parseWallPayload(raw: unknown): { enabled: boolean; blockedCountries: string[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as {
    enabled?: boolean;
    blockedCountries?: unknown;
    vpnWall?: { enabled?: boolean; blockedCountries?: unknown };
    site?: unknown;
    network?: unknown;
    banners?: unknown;
    announcement?: unknown;
  };

  const looksLikeAdsJson =
    "site" in data || "network" in data || "banners" in data || "announcement" in data;

  if (looksLikeAdsJson) {
    // Old ads.json without vpnWall — fall through to snapshot files.
    if (!data.vpnWall || typeof data.vpnWall !== "object") return null;
  }

  const src = data.vpnWall && typeof data.vpnWall === "object" ? data.vpnWall : data;
  const countries = Array.isArray(src.blockedCountries)
    ? src.blockedCountries
        .map((c) => (typeof c === "string" ? normalizeCountryCode(c) : ""))
        .filter((c) => /^[A-Z]{2}$/.test(c))
    : [];

  return {
    enabled: Boolean(src.enabled),
    blockedCountries: countries.length > 0 ? countries : ["MM"],
  };
}

async function readJsonFile(filePath: string): Promise<unknown | null> {
  try {
    const text = await readFile(filePath, "utf8");
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * Wall config from disk (uploads snapshot → data snapshot → ads.json).
 * Cached ~10s so admin toggles apply quickly without hammering disk.
 */
export async function readVpnWallPublicConfig(
  _origin?: string,
): Promise<{ enabled: boolean; blockedCountries: string[] }> {
  const now = Date.now();
  if (configCache && configCache.expiresAt > now) {
    return {
      enabled: configCache.enabled,
      blockedCountries: configCache.blockedCountries,
    };
  }

  // ads.json is the admin source of truth; snapshots are mirrors.
  const candidates = [ADS_JSON, DATA_VPN_WALL, UPLOADS_VPN_WALL];
  for (const file of candidates) {
    const raw = await readJsonFile(file);
    const parsed = parseWallPayload(raw);
    if (!parsed) continue;
    configCache = { ...parsed, expiresAt: now + CONFIG_TTL_MS };
    return parsed;
  }

  return { enabled: false, blockedCountries: ["MM"] };
}

export function isBlockedCountry(
  country: string,
  blockedCountries: string[],
): boolean {
  if (!country) return false;
  return blockedCountries.includes(country);
}

/** Clear config cache after admin save (same process). */
export function invalidateVpnWallConfigCache(): void {
  configCache = null;
}
