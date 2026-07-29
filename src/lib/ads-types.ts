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
}

export interface AdsConfig {
  site: SiteConfig;
  announcement: AnnouncementConfig;
  banners: Record<AdSlotId, AdBannerConfig>;
  updatedAt: string;
}

export const DEFAULT_ADS_CONFIG: AdsConfig = {
  site: {
    siteName: "LuuGyi Zcar",
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
  updatedAt: new Date(0).toISOString(),
};

export function isSlotId(value: string): value is AdSlotId {
  return AD_SLOTS.some((slot) => slot.id === value);
}
