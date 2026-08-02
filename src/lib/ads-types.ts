/** Named placements that match the red boxes on home + video pages. */
export const AD_SLOTS = [
  {
    id: "home-top",
    label: "Home — top banner",
    description: "Below categories, above Trending Now",
  },
  {
    id: "home-bottom",
    label: "Home — bottom banner",
    description: "Below the video grid",
  },
  {
    id: "video-mid",
    label: "Video page — mid banner",
    description: "Below tags, above Related Videos",
  },
] as const;

export type AdSlotId = (typeof AD_SLOTS)[number]["id"];

/**
 * ExoClick placements — deliberately separate from AD_SLOTS.
 *
 * AD_SLOTS drives the self-hosted GIF banners sold directly. Network zones are a
 * second, independent layer so enabling one can never disturb the other.
 */
export const NETWORK_SLOTS = [
  {
    id: "net-home-top",
    label: "ExoClick — home top",
    description: "Above Trending Now",
  },
  {
    id: "net-home-bottom",
    label: "ExoClick — home bottom",
    description: "Below the video feed",
  },
  {
    id: "net-video-below",
    label: "ExoClick — video page",
    description: "Below the player meta row",
  },
  {
    id: "net-interstitial-desktop",
    label: "ExoClick — interstitial (desktop)",
    description: "Desktop Fullpage Interstitial zone. Fires when a visitor clicks a video.",
  },
  {
    id: "net-interstitial-mobile",
    label: "ExoClick — interstitial (mobile)",
    description: "Mobile Fullpage Interstitial zone — a separate zone type in ExoClick.",
  },
  {
    id: "net-in-page-push",
    label: "ExoClick — in-page push",
    description:
      "In-Page Push (native push look). Position is set in ExoClick (e.g. top-right). Loads on every page.",
  },
] as const;

/** Interstitial zones live on listing pages, not the video page (see below). */
export const INTERSTITIAL_SLOTS = [
  "net-interstitial-desktop",
  "net-interstitial-mobile",
] as const;

/** Floating formats that should load site-wide from the root layout. */
export const SITEWIDE_NETWORK_SLOTS = ["net-in-page-push"] as const;

export type NetworkSlotId = (typeof NETWORK_SLOTS)[number]["id"];

export interface NetworkZoneConfig {
  enabled: boolean;
  /** ExoClick zone id — digits only, enforced on read and on save. */
  zoneId: string;
  /**
   * The `<ins class="…">` from this zone's ExoClick HTML tag.
   *
   * Required per zone when ExoClick issues a different class for each zone
   * (common for Fullpage Interstitial vs Banner). Empty falls back to
   * network.insClass, then EXOCLICK_INS_CLASS.
   */
  insClass: string;
}

export interface AdNetworkConfig {
  /** Master switch. Off means ad-provider.js is never even requested. */
  enabled: boolean;
  zones: Record<NetworkSlotId, NetworkZoneConfig>;
  /** Stored for later; no popunder script is injected by this app. */
  popunderZoneId: string;
  /**
   * ExoClick site-verification code — the `content` value of their meta tag.
   *
   * Rendered independently of `enabled`, because ownership must be verified
   * before any zone exists to switch on.
   */
  verificationCode: string;
  /**
   * The `<ins>` class this site's ExoClick account issues.
   *
   * Empty falls back to EXOCLICK_INS_CLASS. Per-site so each domain can run its
   * own ExoClick account without a class mismatch silently killing its ads.
   */
  insClass: string;
}

/** Meta tag name ExoClick looks for when verifying domain ownership. */
export const EXOCLICK_VERIFICATION_META = "6a97888e-site-verification";

/**
 * Default class name ExoClick's ad-provider.js scans for when placing a zone.
 *
 * Prefer setting `insClass` per zone from the dashboard tag — ExoClick often
 * issues a different class for Banner vs Fullpage Interstitial (and even
 * desktop vs mobile interstitial).
 */
export const EXOCLICK_INS_CLASS = "eas6a97888e2";

/** Pick the most specific valid <ins> class for a zone. */
export function resolveInsClass(
  zone: Pick<NetworkZoneConfig, "insClass"> | null | undefined,
  network: Pick<AdNetworkConfig, "insClass"> | null | undefined,
): string {
  const zoneClass = zone?.insClass?.trim() ?? "";
  if (zoneClass && isValidInsClass(zoneClass)) return zoneClass;
  const siteClass = network?.insClass?.trim() ?? "";
  if (siteClass && isValidInsClass(siteClass)) return siteClass;
  return EXOCLICK_INS_CLASS;
}

/** Must be usable as a bare CSS class in a className attribute. */
export function isValidInsClass(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_-]{2,64}$/.test(value);
}

/** Verification codes are hex-ish tokens; reject anything that could break markup. */
export function isValidVerificationCode(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(value);
}

export function isNetworkSlotId(value: string): value is NetworkSlotId {
  return NETWORK_SLOTS.some((slot) => slot.id === value);
}

/** ExoClick zone ids are numeric; anything else is rejected rather than rendered. */
export function isValidZoneId(value: string): boolean {
  return /^\d{1,12}$/.test(value);
}

export interface AdBannerConfig {
  enabled: boolean;
  /** Public URL path, e.g. /uploads/ads/home-top.gif */
  imageUrl: string;
  /** Optional click-through destination */
  linkUrl: string;
  alt: string;
}

export interface AnnouncementDialogItem {
  id: string;
  enabled: boolean;
  title: string;
  text: string;
  contactLabel: string;
  contactUrl: string;
}

export interface AnnouncementConfig {
  enabled: boolean;
  /** Popup dialog on first home visit */
  showDialog: boolean;
  /** Multiple popup messages shown in sequence. */
  dialogs: AnnouncementDialogItem[];
  /** Inline banner under categories on home */
  showInline: boolean;
  /** Main Burmese / promo body */
  text: string;
  /** Contact line, e.g. Telegram handle */
  contactLabel: string;
  contactUrl: string;
  /** Secondary CTA for advertisers (inline banner only) */
  adsLabel: string;
  adsContact: string;
  adsContactUrl: string;
}

export interface SiteConfig {
  /** Brand name shown in header, footer, and metadata. */
  siteName: string;
  /** Per-site description for SEO, previews, and footer copy. */
  siteDescription: string;
}

export interface AdsConfig {
  site: SiteConfig;
  announcement: AnnouncementConfig;
  banners: Record<AdSlotId, AdBannerConfig>;
  /** ExoClick layer — independent of `banners`. */
  network: AdNetworkConfig;
  updatedAt: string;
}

export const DEFAULT_ADS_CONFIG: AdsConfig = {
  site: {
    siteName: "LuuGyi Zcar",
    siteDescription: "Browse and search HD videos across Korea, Japan, Asian, amateur and more categories.",
  },
  announcement: {
    enabled: true,
    showDialog: true,
    dialogs: [
      {
        id: "vip",
        enabled: true,
        title: "VIP Announcement",
        text: "မြန်မာ solo / မြန်မာချောင်းရိုက် / ကလေးကား /\nမြန်မာlocal leak/Yoon May/စစ်ဗိုလ်မိန်းမ/tiktok cele\nHD တိုကို တစ်သက်စာ Vip ကြေး 8999ကျပ်ဖြင့်\nဝယ်ယူကြည့်ရှုနိုင်ပါပြီ",
        contactLabel: "ဆက်သွယ်ရန် admin♠️",
        contactUrl: "https://t.me/VVIPMEMEBR",
      },
    ],
    showInline: true,
    text: "မြန်မာ solo / မြန်မာချောင်းရိုက် / ကလေးကား /\nမြန်မာlocal leak/Yoon May/စစ်ဗိုလ်မိန်းမ/tiktok cele\nHD တိုကို တစ်သက်စာ Vip ကြေး 8999ကျပ်ဖြင့်\nဝယ်ယူကြည့်ရှုနိုင်ပါပြီ",
    contactLabel: "ဆက်သွယ်ရန် admin♠️",
    contactUrl: "https://t.me/VVIPMEMEBR",
    adsLabel: "ကြော်ငြာထည့်သွင်းလိုပါက admin 👉",
    adsContact: "@VVIPMEMEBR",
    adsContactUrl: "https://t.me/VVIPMEMEBR",
  },
  banners: {
    "home-top": {
      enabled: false,
      imageUrl: "",
      linkUrl: "",
      alt: "Advertisement",
    },
    "home-bottom": {
      enabled: false,
      imageUrl: "",
      linkUrl: "",
      alt: "Advertisement",
    },
    "video-mid": {
      enabled: false,
      imageUrl: "",
      linkUrl: "",
      alt: "Advertisement",
    },
  },
  // Everything off by default: an existing deployment picks up this key on the
  // next read and renders exactly as it did before.
  network: {
    enabled: false,
    zones: {
      "net-home-top": { enabled: false, zoneId: "", insClass: "" },
      "net-home-bottom": { enabled: false, zoneId: "", insClass: "" },
      "net-video-below": { enabled: false, zoneId: "", insClass: "" },
      "net-interstitial-desktop": { enabled: false, zoneId: "", insClass: "" },
      "net-interstitial-mobile": { enabled: false, zoneId: "", insClass: "" },
      "net-in-page-push": { enabled: false, zoneId: "", insClass: "" },
    },
    popunderZoneId: "",
    verificationCode: "",
    insClass: "",
  },
  updatedAt: new Date(0).toISOString(),
};

export function isSlotId(value: string): value is AdSlotId {
  return AD_SLOTS.some((slot) => slot.id === value);
}
