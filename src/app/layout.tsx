import type { Metadata, Viewport } from "next";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { readAdsConfig } from "@/lib/ads";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const ads = await readAdsConfig();
  const siteName = ads.site.siteName;

  return {
    // Without metadataBase every OG/Twitter image URL stays relative, and social
    // scrapers silently drop them.
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${siteName} — Free HD Videos`,
      template: `%s | ${siteName}`,
    },
    description: SITE_DESCRIPTION,
    openGraph: {
      siteName,
      type: "website",
      locale: "en_US",
      title: `${siteName} — Free HD Videos`,
      description: SITE_DESCRIPTION,
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

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-ink-950">
        <Header siteName={ads.site.siteName} />
        <main className="mx-auto w-full max-w-[1800px] flex-1 px-3 py-5 sm:px-5 sm:py-7">
          {children}
        </main>
        <Footer siteName={ads.site.siteName} />
      </body>
    </html>
  );
}
