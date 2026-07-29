import type { Metadata, Viewport } from "next";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LuuGyi Zcar — Free HD Videos",
    template: "%s | LuuGyi Zcar",
  },
  description:
    "Browse and search HD videos across Korea, Japan, Asian, amateur and more categories.",
  robots: { index: false, follow: false },
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
