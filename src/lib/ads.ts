import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  AD_SLOTS,
  DEFAULT_ADS_CONFIG,
  isSlotId,
  type AdBannerConfig,
  type AdsConfig,
  type AdSlotId,
  type AnnouncementConfig,
  type AnnouncementDialogItem,
  type SiteConfig,
} from "@/lib/ads-types";

export type {
  AdBannerConfig,
  AdsConfig,
  AdSlotId,
  AnnouncementConfig,
  AnnouncementDialogItem,
  SiteConfig,
};
export { AD_SLOTS, DEFAULT_ADS_CONFIG, isSlotId };

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "ads.json");

export const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "ads");
export const UPLOAD_PUBLIC_PREFIX = "/uploads/ads";

export function versionedAssetUrl(url: string, version?: string): string {
  if (!url) return url;
  if (!version) return url;

  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${encodeURIComponent(version)}`;
}

function normalizeBanner(raw: Partial<AdBannerConfig> | undefined): AdBannerConfig {
  return {
    enabled: Boolean(raw?.enabled),
    imageUrl: typeof raw?.imageUrl === "string" ? raw.imageUrl.trim() : "",
    linkUrl: typeof raw?.linkUrl === "string" ? raw.linkUrl.trim() : "",
    alt: typeof raw?.alt === "string" && raw.alt.trim() ? raw.alt.trim() : "Advertisement",
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
    updatedAt:
      typeof raw?.updatedAt === "string" ? raw.updatedAt : DEFAULT_ADS_CONFIG.updatedAt,
  };
}

export async function readAdsConfig(): Promise<AdsConfig> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return normalizeConfig(JSON.parse(raw) as Partial<AdsConfig>);
  } catch {
    return structuredClone(DEFAULT_ADS_CONFIG);
  }
}

export async function writeAdsConfig(config: AdsConfig): Promise<AdsConfig> {
  await mkdir(DATA_DIR, { recursive: true });
  const next = normalizeConfig({
    ...config,
    updatedAt: new Date().toISOString(),
  });
  await writeFile(DATA_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export function getBanner(config: AdsConfig, slotId: string): AdBannerConfig | null {
  if (!isSlotId(slotId)) return null;
  return config.banners[slotId];
}
