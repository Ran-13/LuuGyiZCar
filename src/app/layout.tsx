import type { Metadata, Viewport } from "next";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  // Without metadataBase every OG/Twitter image URL stays relative, and social
  // scrapers silently drop them.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Free HD Videos`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
    title: `${SITE_NAME} — Free HD Videos`,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-ink-950">
        <Header />
        <main className="mx-auto w-full max-w-[1800px] flex-1 px-3 py-5 sm:px-5 sm:py-7">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
