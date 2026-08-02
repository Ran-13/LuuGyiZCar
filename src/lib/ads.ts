import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { cache } from "react";
import {
  AD_SLOTS,
  DEFAULT_ADS_CONFIG,
  INTERSTITIAL_SLOTS,
  NETWORK_SLOTS,
  EXOCLICK_VERIFICATION_META,
  EXOCLICK_INS_CLASS,
  SITEWIDE_NETWORK_SLOTS,
  STICKY_BANNER_SLOTS,
  isNetworkSlotId,
  isSlotId,
  isValidInsClass,
  isValidVerificationCode,
  isValidZoneId,
  resolveInsClass,
  type AdBannerConfig,
  type AdNetworkConfig,
  type AdsConfig,
  type AdSlotId,
  type AnnouncementConfig,
  type AnnouncementDialogItem,
  type NetworkSlotId,
  type NetworkZoneConfig,
  type SiteConfig,
  type VpnWallConfig,
} from "@/lib/ads-types";

export type {
  AdBannerConfig,
  AdNetworkConfig,
  AdsConfig,
  AdSlotId,
  AnnouncementConfig,
  AnnouncementDialogItem,
  NetworkSlotId,
  NetworkZoneConfig,
  SiteConfig,
  VpnWallConfig,
};
export {
  AD_SLOTS,
  DEFAULT_ADS_CONFIG,
  EXOCLICK_INS_CLASS,
  EXOCLICK_VERIFICATION_META,
  INTERSTITIAL_SLOTS,
  NETWORK_SLOTS,
  SITEWIDE_NETWORK_SLOTS,
  STICKY_BANNER_SLOTS,
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
    vpnWall: normalizeVpnWall(raw?.vpnWall),
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
