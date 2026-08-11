import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { cache } from "react";
import {
  ADSTERRA_BANNER_SLOTS,
  AD_SLOTS,
  DEFAULT_ADS_CONFIG,
  INTERSTITIAL_SLOTS,
  NETWORK_SLOTS,
  EXOCLICK_VERIFICATION_META,
  EXOCLICK_INS_CLASS,
  SITEWIDE_NETWORK_SLOTS,
  STICKY_BANNER_SLOTS,
  STICKY_BOTTOM_SLOTS,
  STICKY_TOP_SLOTS,
  isNetworkSlotId,
  isSlotId,
  isValidInsClass,
  isValidVerificationCode,
  isValidZoneId,
  resolveInsClass,
  extractAdsterraScriptSrc,
  type AdBannerConfig,
  type AdNetworkConfig,
  type AdsConfig,
  type AdSlotId,
  type AdsterraBannerSlotId,
  type AdsterraBannerUnit,
  type AdsterraConfig,
  type AdsterraScript,
  type AnnouncementConfig,
  type AnnouncementDialogItem,
  type FeedConfig,
  type NetworkSlotId,
  type NetworkZoneConfig,
  type PlaybackConfig,
  type SiteConfig,
  type VpnWallConfig,
} from "@/lib/ads-types";
import { DEFAULT_CATEGORIES, slugifyCategory, type Category } from "@/lib/categories";
import { isSortOrder, DEFAULT_ORDER } from "@/lib/eporner";

export type {
  AdBannerConfig,
  AdNetworkConfig,
  AdsConfig,
  AdSlotId,
  AdsterraBannerSlotId,
  AdsterraBannerUnit,
  AdsterraConfig,
  AdsterraScript,
  AnnouncementConfig,
  AnnouncementDialogItem,
  FeedConfig,
  NetworkSlotId,
  NetworkZoneConfig,
  PlaybackConfig,
  SiteConfig,
  VpnWallConfig,
};
export {
  ADSTERRA_BANNER_SLOTS,
  AD_SLOTS,
  DEFAULT_ADS_CONFIG,
  EXOCLICK_INS_CLASS,
  EXOCLICK_VERIFICATION_META,
  INTERSTITIAL_SLOTS,
  NETWORK_SLOTS,
  SITEWIDE_NETWORK_SLOTS,
  STICKY_BANNER_SLOTS,
  STICKY_BOTTOM_SLOTS,
  STICKY_TOP_SLOTS,
  extractAdsterraScriptSrc,
  isNetworkSlotId,
  isSlotId,
  isValidInsClass,
  isValidVerificationCode,
  isValidZoneId,
  resolveInsClass,
};

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "ads.json");

export const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "ads");
export const UPLOAD_PUBLIC_PREFIX = "/uploads/ads";
/** Writable volume paths — proxy reads these from disk (Node runtime). */
const VPN_WALL_UPLOADS_FILE = path.join(process.cwd(), "public", "uploads", "vpn-wall.json");
const VPN_WALL_DATA_FILE = path.join(DATA_DIR, "vpn-wall.json");

function normalizeVpnWall(raw: Partial<VpnWallConfig> | undefined): VpnWallConfig {
  const defaults = DEFAULT_ADS_CONFIG.vpnWall;
  const countries = Array.isArray(raw?.blockedCountries)
    ? raw.blockedCountries
        .map((c) => (typeof c === "string" ? c.trim().toUpperCase() : ""))
        .filter((c) => /^[A-Z]{2}$/.test(c))
    : [];
  return {
    enabled: Boolean(raw?.enabled),
    blockedCountries: countries.length > 0 ? countries : [...defaults.blockedCountries],
    title:
      typeof raw?.title === "string" && raw.title.trim()
        ? raw.title.trim()
        : defaults.title,
    message:
      typeof raw?.message === "string" && raw.message.trim()
        ? raw.message
        : defaults.message,
  };
}

function normalizePlayback(raw: Partial<PlaybackConfig> | undefined): PlaybackConfig {
  // Default ON when missing so existing deployments keep the proxy after upgrade.
  // Explicit `false` turns it off.
  if (raw && typeof raw.proxyEnabled === "boolean") {
    return { proxyEnabled: raw.proxyEnabled };
  }
  return { proxyEnabled: DEFAULT_ADS_CONFIG.playback.proxyEnabled };
}

function normalizeAdsterraBanner(
  raw: Partial<AdsterraBannerUnit> | undefined,
  fallback: AdsterraBannerUnit,
): AdsterraBannerUnit {
  const key = typeof raw?.key === "string" ? raw.key.trim() : "";
  const width = Number(raw?.width);
  const height = Number(raw?.height);
  const invokeHost =
    typeof raw?.invokeHost === "string"
      ? raw.invokeHost.trim().replace(/^https?:\/\//, "").replace(/\/$/, "")
      : "";
  return {
    enabled: Boolean(raw?.enabled) && Boolean(key),
    key: /^[a-f0-9]{8,64}$/i.test(key) ? key : "",
    width: Number.isFinite(width) && width > 0 ? Math.min(Math.round(width), 1200) : fallback.width,
    height:
      Number.isFinite(height) && height > 0 ? Math.min(Math.round(height), 1200) : fallback.height,
    invokeHost: invokeHost && /^[a-z0-9.-]+$/i.test(invokeHost) ? invokeHost : "",
  };
}

function normalizeAdsterraScript(
  raw: Partial<AdsterraScript> | undefined,
  index: number,
): AdsterraScript {
  const src = extractAdsterraScriptSrc(typeof raw?.src === "string" ? raw.src : "");
  const id =
    typeof raw?.id === "string" && raw.id.trim()
      ? raw.id.trim().replace(/[^a-zA-Z0-9._-]/g, "-")
      : `script-${index + 1}`;
  const label =
    typeof raw?.label === "string" && raw.label.trim() ? raw.label.trim() : `Script ${index + 1}`;
  return {
    id,
    enabled: Boolean(raw?.enabled) && Boolean(src),
    label,
    src,
  };
}

function normalizeAdsterra(raw: Partial<AdsterraConfig> | undefined): AdsterraConfig {
  const defaults = DEFAULT_ADS_CONFIG.adsterra;
  const incomingScripts = Array.isArray(raw?.scripts) ? raw.scripts : null;
  const scripts =
    incomingScripts && incomingScripts.length > 0
      ? incomingScripts.map((s, i) => normalizeAdsterraScript(s, i)).slice(0, 8)
      : defaults.scripts.map((s) => ({ ...s }));

  const banners = { ...defaults.banners };
  for (const slot of ADSTERRA_BANNER_SLOTS) {
    banners[slot.id] = normalizeAdsterraBanner(raw?.banners?.[slot.id], defaults.banners[slot.id]);
  }

  return {
    enabled: Boolean(raw?.enabled),
    scripts,
    banners,
  };
}

function normalizeCategory(raw: Partial<Category> | undefined, index: number): Category | null {
  const label = typeof raw?.label === "string" ? raw.label.trim() : "";
  const query = typeof raw?.query === "string" ? raw.query.trim() : "";
  if (!label || !query) return null;
  const slugRaw = typeof raw?.slug === "string" ? raw.slug.trim() : "";
  const slug = slugifyCategory(slugRaw || label) || `cat-${index + 1}`;
  const description =
    typeof raw?.description === "string" && raw.description.trim()
      ? raw.description.trim()
      : `${label} videos.`;
  return { slug, label, query, description };
}

function normalizeFeed(raw: Partial<FeedConfig> | undefined): FeedConfig {
  const defaults = DEFAULT_ADS_CONFIG.feed;
  const orderRaw = typeof raw?.homeOrder === "string" ? raw.homeOrder.trim() : "";
  const homeOrder = isSortOrder(orderRaw) ? orderRaw : DEFAULT_ORDER;

  const incoming = Array.isArray(raw?.categories) ? raw.categories : null;
  const categories: Category[] = [];
  const seen = new Set<string>();
  if (incoming && incoming.length > 0) {
    incoming.forEach((item, index) => {
      const cat = normalizeCategory(item, index);
      if (!cat || seen.has(cat.slug)) return;
      seen.add(cat.slug);
      categories.push(cat);
    });
  }

  return {
    homeQuery: typeof raw?.homeQuery === "string" ? raw.homeQuery.trim() : defaults.homeQuery,
    homeOrder,
    homeTitle:
      typeof raw?.homeTitle === "string" && raw.homeTitle.trim()
        ? raw.homeTitle.trim()
        : defaults.homeTitle,
    homeSubtitle:
      typeof raw?.homeSubtitle === "string" && raw.homeSubtitle.trim()
        ? raw.homeSubtitle.trim()
        : defaults.homeSubtitle,
    relatedFallbackQuery:
      typeof raw?.relatedFallbackQuery === "string" && raw.relatedFallbackQuery.trim()
        ? raw.relatedFallbackQuery.trim()
        : defaults.relatedFallbackQuery,
    categories:
      categories.length > 0
        ? categories
        : DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  };
}

async function writeVpnWallPublicSnapshot(vpnWall: VpnWallConfig): Promise<void> {
  const payload = JSON.stringify(
    {
      enabled: vpnWall.enabled,
      blockedCountries: vpnWall.blockedCountries,
      title: vpnWall.title,
      message: vpnWall.message,
    },
    null,
    2,
  );
  await mkdir(path.dirname(VPN_WALL_UPLOADS_FILE), { recursive: true });
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(VPN_WALL_UPLOADS_FILE, payload, "utf8");
  await writeFile(VPN_WALL_DATA_FILE, payload, "utf8");
}

function normalizeBanner(raw: Partial<AdBannerConfig> | undefined): AdBannerConfig {
  return {
    enabled: Boolean(raw?.enabled),
    imageUrl: typeof raw?.imageUrl === "string" ? raw.imageUrl.trim() : "",
    linkUrl: typeof raw?.linkUrl === "string" ? raw.linkUrl.trim() : "",
    alt: typeof raw?.alt === "string" && raw.alt.trim() ? raw.alt.trim() : "Advertisement",
  };
}

function normalizeZone(raw: Partial<NetworkZoneConfig> | undefined): NetworkZoneConfig {
  const zoneId = typeof raw?.zoneId === "string" ? raw.zoneId.trim() : "";
  const insClass = typeof raw?.insClass === "string" ? raw.insClass.trim() : "";
  return {
    enabled: Boolean(raw?.enabled),
    // Rejected here as well as on save: the id lands in a DOM attribute, and a
    // hand-edited ads.json is not a trusted source.
    zoneId: isValidZoneId(zoneId) ? zoneId : "",
    insClass: isValidInsClass(insClass) ? insClass : "",
  };
}

function normalizeNetwork(raw: Partial<AdNetworkConfig> | undefined): AdNetworkConfig {
  const zonesIn: Partial<Record<NetworkSlotId, Partial<NetworkZoneConfig>>> = raw?.zones ?? {};
  const zones = { ...DEFAULT_ADS_CONFIG.network.zones };
  for (const slot of NETWORK_SLOTS) {
    zones[slot.id] = normalizeZone(zonesIn[slot.id]);
  }

  const popunder = typeof raw?.popunderZoneId === "string" ? raw.popunderZoneId.trim() : "";
  const verification =
    typeof raw?.verificationCode === "string" ? raw.verificationCode.trim() : "";
  const insClass = typeof raw?.insClass === "string" ? raw.insClass.trim() : "";

  return {
    enabled: Boolean(raw?.enabled),
    zones,
    popunderZoneId: isValidZoneId(popunder) ? popunder : "",
    popunderEnabled: Boolean(raw?.popunderEnabled),
    verificationCode: isValidVerificationCode(verification) ? verification : "",
    // Empty is meaningful: the component falls back to the platform default.
    insClass: isValidInsClass(insClass) ? insClass : "",
  };
}

function normalizeDialog(
  raw: Partial<AnnouncementDialogItem> | undefined,
  fallbackId: string,
): AnnouncementDialogItem {
  return {
    id: typeof raw?.id === "string" && raw.id.trim() ? raw.id.trim() : fallbackId,
    enabled: raw?.enabled !== false,
    title: typeof raw?.title === "string" ? raw.title.trim() : "",
    text: typeof raw?.text === "string" ? raw.text : "",
    contactLabel: typeof raw?.contactLabel === "string" ? raw.contactLabel : "",
    contactUrl: typeof raw?.contactUrl === "string" ? raw.contactUrl : "",
  };
}

function normalizeConfig(raw: Partial<AdsConfig> | null | undefined): AdsConfig {
  const site: Partial<SiteConfig> = raw?.site ?? {};
  const announcement: Partial<AnnouncementConfig> = raw?.announcement ?? {};
  const bannersIn: Partial<Record<AdSlotId, Partial<AdBannerConfig>>> = raw?.banners ?? {};
  const rawDialogs = Array.isArray(announcement.dialogs) ? announcement.dialogs : [];

  const banners = { ...DEFAULT_ADS_CONFIG.banners };
  for (const slot of AD_SLOTS) {
    banners[slot.id] = normalizeBanner(bannersIn[slot.id]);
  }

  const fallbackDialog = {
    id: "vip",
    enabled: announcement.enabled !== false,
    title: "VIP Announcement",
    text:
      typeof announcement.text === "string" && announcement.text.trim()
        ? announcement.text
        : DEFAULT_ADS_CONFIG.announcement.text,
    contactLabel:
      typeof announcement.contactLabel === "string"
        ? announcement.contactLabel
        : DEFAULT_ADS_CONFIG.announcement.contactLabel,
    contactUrl:
      typeof announcement.contactUrl === "string"
        ? announcement.contactUrl
        : DEFAULT_ADS_CONFIG.announcement.contactUrl,
  } satisfies AnnouncementDialogItem;

  const dialogs =
    rawDialogs.length > 0
      ? rawDialogs.map((dialog, index) => normalizeDialog(dialog, `dialog-${index + 1}`))
      : [fallbackDialog];

  return {
    site: {
      siteName:
        typeof site.siteName === "string" && site.siteName.trim()
          ? site.siteName.trim()
          : DEFAULT_ADS_CONFIG.site.siteName,
      siteDescription:
        typeof site.siteDescription === "string" && site.siteDescription.trim()
          ? site.siteDescription.trim()
          : DEFAULT_ADS_CONFIG.site.siteDescription,
    },
    announcement: {
      enabled: announcement.enabled !== false,
      showDialog: announcement.showDialog !== false,
      dialogs,
      showInline: announcement.showInline !== false,
      text:
        typeof announcement.text === "string" && announcement.text.trim()
          ? announcement.text
          : DEFAULT_ADS_CONFIG.announcement.text,
      contactLabel:
        typeof announcement.contactLabel === "string"
          ? announcement.contactLabel
          : DEFAULT_ADS_CONFIG.announcement.contactLabel,
      contactUrl:
        typeof announcement.contactUrl === "string"
          ? announcement.contactUrl
          : DEFAULT_ADS_CONFIG.announcement.contactUrl,
      adsLabel:
        typeof announcement.adsLabel === "string"
          ? announcement.adsLabel
          : DEFAULT_ADS_CONFIG.announcement.adsLabel,
      adsContact:
        typeof announcement.adsContact === "string"
          ? announcement.adsContact
          : DEFAULT_ADS_CONFIG.announcement.adsContact,
      adsContactUrl:
        typeof announcement.adsContactUrl === "string"
          ? announcement.adsContactUrl
          : DEFAULT_ADS_CONFIG.announcement.adsContactUrl,
    },
    banners,
    network: normalizeNetwork(raw?.network),
    adsterra: normalizeAdsterra(raw?.adsterra),
    vpnWall: normalizeVpnWall(raw?.vpnWall),
    playback: normalizePlayback(raw?.playback),
    feed: normalizeFeed(raw?.feed),
    updatedAt:
      typeof raw?.updatedAt === "string" ? raw.updatedAt : DEFAULT_ADS_CONFIG.updatedAt,
  };
}

/**
 * Reads the per-site ads/branding config.
 *
 * Wrapped in React `cache()` so the disk read + parse happens once per request
 * instead of once per call site. The root layout alone calls this twice
 * (generateMetadata and the layout body) before any page adds its own call.
 */
export const readAdsConfig = cache(async (): Promise<AdsConfig> => {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return normalizeConfig(JSON.parse(raw) as Partial<AdsConfig>);
  } catch {
    return structuredClone(DEFAULT_ADS_CONFIG);
  }
});

export async function writeAdsConfig(config: AdsConfig): Promise<AdsConfig> {
  await mkdir(DATA_DIR, { recursive: true });
  const next = normalizeConfig({
    ...config,
    updatedAt: new Date().toISOString(),
  });
  await writeFile(DATA_FILE, JSON.stringify(next, null, 2), "utf8");
  await writeVpnWallPublicSnapshot(next.vpnWall);
  return next;
}

export function getBanner(config: AdsConfig, slotId: string): AdBannerConfig | null {
  if (!isSlotId(slotId)) return null;
  return config.banners[slotId];
}
