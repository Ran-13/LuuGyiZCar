import { NextResponse } from "next/server";
import { AD_SLOTS, type AdsConfig, type AdSlotId, readAdsConfig, writeAdsConfig } from "@/lib/ads";
import { requireAdminApi } from "@/lib/admin-guard";

export async function GET(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;

  const config = await readAdsConfig();
  return NextResponse.json(config, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PUT(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;

  let body: Partial<AdsConfig>;
  try {
    body = (await request.json()) as Partial<AdsConfig>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const current = await readAdsConfig();
  const banners = { ...current.banners };

  if (body.banners) {
    for (const slot of AD_SLOTS) {
      const id = slot.id as AdSlotId;
      const incoming = body.banners[id];
      if (!incoming) continue;
      banners[id] = {
        enabled: Boolean(incoming.enabled),
        imageUrl: typeof incoming.imageUrl === "string" ? incoming.imageUrl.trim() : "",
        linkUrl: typeof incoming.linkUrl === "string" ? incoming.linkUrl.trim() : "",
        alt:
          typeof incoming.alt === "string" && incoming.alt.trim()
            ? incoming.alt.trim()
            : "Advertisement",
      };
    }
  }

  const announcement = {
    ...current.announcement,
    ...(body.announcement ?? {}),
  };

  const saved = await writeAdsConfig({
    announcement: {
      enabled: Boolean(announcement.enabled),
      showDialog: announcement.showDialog !== false,
      showInline: announcement.showInline !== false,
      text: String(announcement.text ?? ""),
      contactLabel: String(announcement.contactLabel ?? ""),
      contactUrl: String(announcement.contactUrl ?? ""),
      adsLabel: String(announcement.adsLabel ?? ""),
      adsContact: String(announcement.adsContact ?? ""),
      adsContactUrl: String(announcement.adsContactUrl ?? ""),
    },
    banners,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json(saved, {
    headers: { "Cache-Control": "no-store" },
  });
}
