import type { Metadata, Viewport } from "next";
import ExoClickProvider from "@/components/ExoClickProvider";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
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

  // Collect all enabled banner image URLs for preloading in <head>
  const bannerUrls = Object.values(ads.banners)
    .filter((b) => b.enabled && b.imageUrl)
    .map((b) => b.imageUrl);

  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/* DNS prefetch + preconnect for video thumbnail CDN */}
        <link rel="dns-prefetch" href="https://static-ca-cdn.eporner.com" />
        <link rel="preconnect" href="https://static-ca-cdn.eporner.com" crossOrigin="anonymous" />
        {/* Preload all enabled banner GIFs — browser fetches before body parse */}
        {bannerUrls.map((url) => (
          <link key={url} rel="preload" href={url} as="image" fetchPriority="high" />
        ))}
      </head>
      <body className="flex min-h-full flex-col bg-ink-950">
        <Header siteName={ads.site.siteName} />
        <main className="w-full flex-1 px-3 py-5 sm:px-5 sm:py-7">
          {children}
        </main>
        <Footer siteName={ads.site.siteName} siteDescription={ads.site.siteDescription} />
        <ExoClickProvider network={ads.network} />
      </body>
    </html>
  );
}
