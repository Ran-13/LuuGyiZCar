/**
 * Country lookup + VPN wall helpers.
 *
 * Country detection uses a free HTTPS geo API with an in-process cache so the
 * Edge proxy does not hammer the provider on every navigation.
 */

const GEO_TTL_MS = 60 * 60 * 1000; // 1 hour per IP
const CONFIG_TTL_MS = 15_000; // admin toggles show up quickly

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

/** Best-effort client IP (honours proxy headers when TRUST_PROXY_HEADERS=true). */
export function getRequestIp(headers: Headers): string | null {
  if (process.env.TRUST_PROXY_HEADERS === "true") {
    const forwarded = headers.get("x-forwarded-for");
    const clientIp = forwarded?.split(",")[0]?.trim();
    if (clientIp) return clientIp;
    const realIp = headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;
  }
  return null;
}

function normalizeCountryCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

/** ISO country code, or "" when unknown (caller should fail-open). */
export async function lookupCountryCode(ip: string | null): Promise<string> {
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip === "::1") return "";

  const cached = geoCache.get(ip);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.country;

  try {
    // Free HTTPS geo — no API key. Fail-open on errors.
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { success?: boolean; country_code?: string };
    const country =
      data.success === false ? "" : normalizeCountryCode(data.country_code);
    geoCache.set(ip, { country, expiresAt: now + GEO_TTL_MS });
    // Bound memory: drop oldest-ish entries when large.
    if (geoCache.size > 5000) {
      const first = geoCache.keys().next().value;
      if (first) geoCache.delete(first);
    }
    return country;
  } catch {
    return "";
  }
}

/**
 * Reads the public vpn-wall.json snapshot written alongside ads.json.
 * Edge-safe (fetch only). Cached briefly so toggles apply within ~15s.
 */
export async function readVpnWallPublicConfig(
  origin: string,
): Promise<{ enabled: boolean; blockedCountries: string[] }> {
  const now = Date.now();
  if (configCache && configCache.expiresAt > now) {
    return {
      enabled: configCache.enabled,
      blockedCountries: configCache.blockedCountries,
    };
  }

  try {
    const res = await fetch(`${origin}/uploads/vpn-wall.json`, {
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
    if (!res.ok) {
      return { enabled: false, blockedCountries: ["MM"] };
    }
    const data = (await res.json()) as {
      enabled?: boolean;
      blockedCountries?: string[];
    };
    const blockedCountries = Array.isArray(data.blockedCountries)
      ? data.blockedCountries.map(normalizeCountryCode).filter(Boolean)
      : ["MM"];
    const entry = {
      enabled: Boolean(data.enabled),
      blockedCountries: blockedCountries.length > 0 ? blockedCountries : ["MM"],
      expiresAt: now + CONFIG_TTL_MS,
    };
    configCache = entry;
    return { enabled: entry.enabled, blockedCountries: entry.blockedCountries };
  } catch {
    return { enabled: false, blockedCountries: ["MM"] };
  }
}

export function isBlockedCountry(
  country: string,
  blockedCountries: string[],
): boolean {
  if (!country) return false;
  return blockedCountries.includes(country);
}
