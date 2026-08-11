import type { Metadata, Viewport } from "next";
import AdBanner from "@/components/AdBanner";
import AdsterraScripts from "@/components/AdsterraScripts";
import ExoClickInPagePush from "@/components/ExoClickInPagePush";
import ExoClickPopunder from "@/components/ExoClickPopunder";
import ExoClickProvider from "@/components/ExoClickProvider";
import ExoClickStickyBanner from "@/components/ExoClickStickyBanner";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import SiteAnalytics from "@/components/SiteAnalytics";
import { EXOCLICK_VERIFICATION_META, readAdsConfig } from "@/lib/ads";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const ads = await readAdsConfig();
  const siteName = ads.site.siteName;
  const siteDescription = ads.site.siteDescription;

  // Emitted whenever a code is set, regardless of network.enabled — ownership
  // has to be verified before there are any zones to turn on.
  const verification = ads.network.verificationCode
    ? { [EXOCLICK_VERIFICATION_META]: ads.network.verificationCode }
    : undefined;

  return {
    // Without metadataBase every OG/Twitter image URL stays relative, and social
    // scrapers silently drop them.
    metadataBase: new URL(SITE_URL),
    ...(verification ? { other: verification } : {}),
    title: {
      default: `${siteName} — Free HD Videos`,
      template: `%s | ${siteName}`,
    },
    description: siteDescription,
    openGraph: {
      siteName,
      type: "website",
      locale: "en_US",
      title: `${siteName} — Free HD Videos`,
      description: siteDescription,
    },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ads = await readAdsConfig();

  // Only warm the sticky bar (sitewide). Home-top / video-mid preload on their pages.
  const stickyBanner = ads.banners["home-bottom"];
  const stickyPreload =
    stickyBanner?.enabled && stickyBanner.imageUrl ? stickyBanner.imageUrl : null;

  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/* DNS prefetch + preconnect for thumbnails + embed player */}
        <link rel="dns-prefetch" href="https://static-ca-cdn.eporner.com" />
        <link rel="preconnect" href="https://static-ca-cdn.eporner.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.eporner.com" />
        <link rel="preconnect" href="https://www.eporner.com" crossOrigin="anonymous" />
        {stickyPreload ? (
          <link rel="preload" href={stickyPreload} as="image" fetchPriority="low" />
        ) : null}
      </head>
      <body className="flex min-h-full flex-col bg-ink-950">
        <Header siteName={ads.site.siteName} categories={ads.feed.categories} />
        <main className="w-full flex-1 px-3 py-5 sm:px-5 sm:py-7">
          {children}
        </main>
        <Footer
          siteName={ads.site.siteName}
          siteDescription={ads.site.siteDescription}
          categories={ads.feed.categories}
        />
        {/* Own GIF sticky — viewport-fixed on every public page including video details. */}
        <AdBanner banner={ads.banners["home-bottom"]} sticky priority={false} />
        <ExoClickInPagePush network={ads.network} />
        <ExoClickStickyBanner network={ads.network} />
        <ExoClickPopunder network={ads.network} />
        <ExoClickProvider network={ads.network} />
        <AdsterraScripts adsterra={ads.adsterra} />
        <SiteAnalytics />
      </body>
    </html>
  );
}
