import type { Category } from "@/lib/categories";
import { DEFAULT_CATEGORIES } from "@/lib/categories";

/** Named placements that match the red boxes on home + video pages. */
export const AD_SLOTS = [
  {
    id: "home-top",
    label: "Home — top banner",
    description: "Below categories, above Trending Now",
  },
  {
    id: "home-bottom",
    label: "Sticky bottom banner (GIF)",
    description: "Fixed to the bottom on every page (home + video details). Not in the scroll.",
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
    id: "net-video-native",
    label: "ExoClick — related native / recommendation",
    description:
      "Native / Recommendation Widget on the video page — sits under “Related Videos”. Create a Native or Recommendation zone in ExoClick.",
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
  {
    id: "net-multi-format",
    label: "ExoClick — multi format",
    description:
      "Multi Format zone. Paste Zone ID + Ad tag class from the HTML tag (e.g. eas6a97888e38). Loads on every page; layout is set in ExoClick.",
  },
  {
    id: "net-sticky-banner",
    label: "ExoClick — sticky bottom #1",
    description:
      "Sticky Banner fixed to the bottom. Create a Sticky Banner zone in ExoClick. Loads on every page.",
  },
  {
    id: "net-sticky-banner-2",
    label: "ExoClick — sticky bottom #2",
    description:
      "Second bottom sticky (stacks above #1). Use another Sticky Banner zone for extra impressions.",
  },
  {
    id: "net-sticky-top",
    label: "ExoClick — sticky top",
    description:
      "Sticky Banner fixed under the header / top of the viewport. Separate Sticky Banner zone.",
  },
] as const;

/** Interstitial zones live on listing pages, not the video page (see below). */
export const INTERSTITIAL_SLOTS = [
  "net-interstitial-desktop",
  "net-interstitial-mobile",
] as const;

/** Floating formats that should load site-wide from the root layout. */
export const SITEWIDE_NETWORK_SLOTS = ["net-in-page-push", "net-multi-format"] as const;

/** Sticky banner zones — fixed bars, site-wide from the root layout. */
export const STICKY_TOP_SLOTS = ["net-sticky-top"] as const;
export const STICKY_BOTTOM_SLOTS = ["net-sticky-banner", "net-sticky-banner-2"] as const;
export const STICKY_BANNER_SLOTS = [...STICKY_TOP_SLOTS, ...STICKY_BOTTOM_SLOTS] as const;

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
  /**
   * ExoClick Popunder zone id (digits). Injected via popunder1000.js when
   * `popunderEnabled` is on and the network master switch is on.
   */
  popunderZoneId: string;
  /** Deliberate opt-in — popunders earn well but are aggressive. */
  popunderEnabled: boolean;
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

/**
 * Per-site video feed — home query/order, categories, related fallback.
 * Stored in ads.json so each domain can show different content.
 */
export interface FeedConfig {
  /** Eporner search query for the home grid. Empty = whole catalog. */
  homeQuery: string;
  /** Sort order for the home grid (e.g. top-weekly, latest). */
  homeOrder: string;
  homeTitle: string;
  homeSubtitle: string;
  /** Used on video pages when the clip has no usable tags. */
  relatedFallbackQuery: string;
  /** Nav + category pages for this site. */
  categories: Category[];
}

/**
 * Myanmar (or other) country wall — visitors whose IP geolocates to a blocked
 * country must use a foreign VPN exit before the site loads.
 */
export interface VpnWallConfig {
  enabled: boolean;
  /** ISO 3166-1 alpha-2 codes (e.g. MM). Empty falls back to ["MM"]. */
  blockedCountries: string[];
  title: string;
  message: string;
}

/** Native stream proxy through this VPS (viewers do not need Eporner VPN). */
export interface PlaybackConfig {
  /**
   * off — Eporner embed only (fast seek; needs user VPN in blocked regions)
   * always — always proxy via VPS
   * auto — try embed when Eporner is reachable; proxy only when blocked
   */
  proxyMode: "off" | "always" | "auto";
  /**
   * @deprecated Use proxyMode. Kept for older ads.json: false→off, true→always.
   */
  proxyEnabled?: boolean;
}

/**
 * Adsterra Social Bar / Popunder style — a single external script URL
 * (like happyworldzone.com: pl….effectivecpmnetwork.com/…/….js).
 */
export interface AdsterraScript {
  id: string;
  enabled: boolean;
  /** e.g. Social Bar, Popunder */
  label: string;
  /** Full https://…/invoke.js or pl….js URL from Adsterra Get code. */
  src: string;
}

/** Classic Adsterra banner (atOptions + invoke.js). */
export interface AdsterraBannerUnit {
  enabled: boolean;
  key: string;
  width: number;
  height: number;
  /**
   * CDN host from the invoke script (no protocol), e.g.
   * www.highperformanceformat.com — empty uses highperformanceformat.com.
   */
  invokeHost: string;
}

export const ADSTERRA_BANNER_SLOTS = [
  {
    id: "ads-home-top",
    label: "Adsterra — home top banner",
    description: "Below categories / above the home video grid",
  },
  {
    id: "ads-home-bottom",
    label: "Adsterra — home bottom banner",
    description: "Below the home video feed",
  },
  {
    id: "ads-video-below",
    label: "Adsterra — video page banner",
    description: "Below the player meta on video pages",
  },
] as const;

export type AdsterraBannerSlotId = (typeof ADSTERRA_BANNER_SLOTS)[number]["id"];

export interface AdsterraConfig {
  /** Master switch for all Adsterra tags. */
  enabled: boolean;
  /**
   * Publisher API token (X-API-Key). Prefer env ADSTERRA_API_KEY on the server;
   * this field is optional per-site override. Never expose to the public site.
   */
  apiKey: string;
  /** Sitewide Social Bar / Popunder scripts (happyworldzone-style). */
  scripts: AdsterraScript[];
  banners: Record<AdsterraBannerSlotId, AdsterraBannerUnit>;
}

export interface AdsConfig {
  site: SiteConfig;
  announcement: AnnouncementConfig;
  banners: Record<AdSlotId, AdBannerConfig>;
  /** ExoClick layer — independent of `banners`. */
  network: AdNetworkConfig;
  /** Adsterra layer — independent of ExoClick. */
  adsterra: AdsterraConfig;
  vpnWall: VpnWallConfig;
  /** VPS stream proxy for the video player. */
  playback: PlaybackConfig;
  feed: FeedConfig;
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
      "net-video-native": { enabled: false, zoneId: "", insClass: "" },
      "net-interstitial-desktop": { enabled: false, zoneId: "", insClass: "" },
      "net-interstitial-mobile": { enabled: false, zoneId: "", insClass: "" },
      "net-in-page-push": { enabled: false, zoneId: "", insClass: "" },
      "net-multi-format": { enabled: false, zoneId: "", insClass: "" },
      "net-sticky-banner": { enabled: false, zoneId: "", insClass: "" },
      "net-sticky-banner-2": { enabled: false, zoneId: "", insClass: "" },
      "net-sticky-top": { enabled: false, zoneId: "", insClass: "" },
    },
    popunderZoneId: "",
    popunderEnabled: false,
    verificationCode: "",
    insClass: "",
  },
  adsterra: {
    enabled: false,
    apiKey: "",
    scripts: [
      {
        id: "social-bar",
        enabled: false,
        label: "Social Bar",
        src: "",
      },
      {
        id: "popunder",
        enabled: false,
        label: "Popunder",
        src: "",
      },
    ],
    banners: {
      "ads-home-top": { enabled: false, key: "", width: 300, height: 250, invokeHost: "" },
      "ads-home-bottom": { enabled: false, key: "", width: 300, height: 100, invokeHost: "" },
      "ads-video-below": { enabled: false, key: "", width: 300, height: 250, invokeHost: "" },
    },
  },
  vpnWall: {
    enabled: false,
    blockedCountries: ["MM"],
    title: "VPN required",
    message: "Vpnလေးချိတ်ပီးမှ ပြန်ဝင်သုံးပေးကြပါ ဗျ",
  },
  playback: {
    proxyMode: "auto",
  },
  feed: {
    homeQuery: "",
    homeOrder: "top-weekly",
    homeTitle: "Trending Now",
    homeSubtitle: "Most watched this week",
    relatedFallbackQuery: "asian",
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  },
  updatedAt: new Date(0).toISOString(),
};

/** Pull src from a bare URL or a pasted <script src="…"> tag. */
export function extractAdsterraScriptSrc(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const fromTag = trimmed.match(/src\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
  let src = fromTag || trimmed;
  if (src.startsWith("//")) src = `https:${src}`;
  try {
    const u = new URL(src);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

export function isSlotId(value: string): value is AdSlotId {
  return AD_SLOTS.some((slot) => slot.id === value);
}
