import type { AnnouncementConfig } from "@/lib/ads-types";

interface HomeAnnouncementProps {
  announcement: AnnouncementConfig;
}

function telegramHandle(url: string, fallback = ""): string {
  const fromUrl = url.match(/t\.me\/([A-Za-z0-9_]+)/i)?.[1];
  if (fromUrl) return `@${fromUrl}`;
  if (fallback.startsWith("@")) return fallback;
  if (fallback) return `@${fallback.replace(/^@/, "")}`;
  return fallback;
}

/** Home-only ads contact line (VIP promo stays in the first-load dialog). */
export default function HomeAnnouncement({ announcement }: HomeAnnouncementProps) {
  const adsHandle =
    announcement.adsContact ||
    telegramHandle(announcement.adsContactUrl, announcement.adsContact);

  if (
    !announcement.enabled ||
    !announcement.showInline ||
    (!announcement.adsLabel.trim() && !adsHandle)
  ) {
    return null;
  }

  return (
    <section aria-label="Advertise with us" className="mb-6 border-b border-ink-700 pb-4">
      <p className="text-[15px] leading-relaxed text-ink-300">
        {announcement.adsLabel}{" "}
        {announcement.adsContactUrl ? (
          <a
            href={announcement.adsContactUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-500 hover:text-brand-400"
          >
            {adsHandle}
          </a>
        ) : (
          <span className="font-semibold text-brand-500">{adsHandle}</span>
        )}
      </p>
    </section>
  );
}
