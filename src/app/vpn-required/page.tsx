import type { Metadata } from "next";
import { readFile } from "fs/promises";
import path from "path";
import { DEFAULT_ADS_CONFIG } from "@/lib/ads-types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "VPN required",
  robots: { index: false, follow: false },
};

async function loadWallCopy(): Promise<{ title: string; message: string }> {
  try {
    const raw = await readFile(
      path.join(process.cwd(), "public", "uploads", "vpn-wall.json"),
      "utf8",
    );
    const data = JSON.parse(raw) as { title?: string; message?: string };
    return {
      title:
        typeof data.title === "string" && data.title.trim()
          ? data.title.trim()
          : DEFAULT_ADS_CONFIG.vpnWall.title,
      message:
        typeof data.message === "string" && data.message.trim()
          ? data.message
          : DEFAULT_ADS_CONFIG.vpnWall.message,
    };
  } catch {
    return {
      title: DEFAULT_ADS_CONFIG.vpnWall.title,
      message: DEFAULT_ADS_CONFIG.vpnWall.message,
    };
  }
}

export default async function VpnRequiredPage() {
  const { title, message } = await loadWallCopy();

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-16 text-center">
      <p className="text-xs font-semibold tracking-wide text-brand-500 uppercase">Access</p>
      <h1 className="mt-3 text-2xl font-bold text-ink-100 sm:text-3xl">{title}</h1>
      <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-ink-300 sm:text-base">
        {message}
      </p>
      <a
        href="/"
        className="mt-8 inline-flex items-center justify-center self-center rounded-md bg-brand-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-brand-400"
      >
        Refresh after connecting VPN
      </a>
    </main>
  );
}
