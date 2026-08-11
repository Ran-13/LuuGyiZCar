import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
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
import {
  DEFAULT_BACKGROUND,
  isDarkBackground,
  siteThemeStyle,
} from "@/lib/site-theme";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const ads = await readAdsConfig();
  const siteName = ads.site.siteName;
  const siteDescription = ads.site.siteDescription;

  const verification = ads.network.verificationCode
    ? { [EXOCLICK_VERIFICATION_META]: ads.network.verificationCode }
    : undefined;

  return {
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

export async function generateViewport(): Promise<Viewport> {
  const ads = await readAdsConfig();
  return {
    themeColor: ads.site.backgroundColor || DEFAULT_BACKGROUND,
    width: "device-width",
    initialScale: 1,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ads = await readAdsConfig();
  const theme = siteThemeStyle(ads.site.backgroundColor, ads.site.textColor);
  const dark = isDarkBackground(ads.site.backgroundColor);

  const stickyBanner = ads.banners["home-bottom"];
  const stickyPreload =
    stickyBanner?.enabled && stickyBanner.imageUrl ? stickyBanner.imageUrl : null;

  return (
    <html
      lang="en"
      className={`h-full antialiased ${dark ? "" : "theme-light"}`.trim()}
      style={theme as CSSProperties}
    >
      <head>
        <link rel="dns-prefetch" href="https://static-ca-cdn.eporner.com" />
        <link rel="preconnect" href="https://static-ca-cdn.eporner.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.eporner.com" />
        <link rel="preconnect" href="https://www.eporner.com" crossOrigin="anonymous" />
        {stickyPreload ? (
          <link rel="preload" href={stickyPreload} as="image" fetchPriority="low" />
        ) : null}
      </head>
      <body className="flex min-h-full flex-col bg-ink-950 text-ink-100">
        <Header siteName={ads.site.siteName} categories={ads.feed.categories} />
        <main className="w-full flex-1 px-3 py-5 sm:px-5 sm:py-7">
          {children}
        </main>
        <Footer
          siteName={ads.site.siteName}
          siteDescription={ads.site.siteDescription}
          categories={ads.feed.categories}
        />
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
