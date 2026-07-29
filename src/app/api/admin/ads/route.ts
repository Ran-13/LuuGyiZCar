import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  AD_SLOTS,
  NETWORK_SLOTS,
  isValidInsClass,
  isValidVerificationCode,
  isValidZoneId,
  type AdsConfig,
  type AdSlotId,
  type AnnouncementDialogItem,
  readAdsConfig,
  writeAdsConfig,
} from "@/lib/ads";
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

  // ExoClick layer — validated independently of `banners` above so the two ad
  // systems can never affect each other.
  const network = { ...current.network };
  if (body.network) {
    const incomingZones = body.network.zones ?? {};
    const zones = { ...current.network.zones };

    for (const slot of NETWORK_SLOTS) {
      const incoming = incomingZones[slot.id];
      if (!incoming) continue;
      const zoneId = typeof incoming.zoneId === "string" ? incoming.zoneId.trim() : "";
      zones[slot.id] = {
        enabled: Boolean(incoming.enabled),
        // Zone ids reach a DOM attribute, so reject anything non-numeric here
        // rather than trusting the client that posted it.
        zoneId: isValidZoneId(zoneId) ? zoneId : "",
      };
    }

    const popunder =
      typeof body.network.popunderZoneId === "string" ? body.network.popunderZoneId.trim() : "";

    const verification =
      typeof body.network.verificationCode === "string"
        ? body.network.verificationCode.trim()
        : "";

    const insClass =
      typeof body.network.insClass === "string" ? body.network.insClass.trim() : "";

    network.enabled = Boolean(body.network.enabled);
    network.zones = zones;
    network.popunderZoneId = isValidZoneId(popunder) ? popunder : "";
    network.verificationCode = isValidVerificationCode(verification) ? verification : "";
    // Empty means "use the platform default", so it must survive validation.
    network.insClass = insClass === "" || isValidInsClass(insClass) ? insClass : "";

    // 0 means "every video", so it must survive validation rather than being
    // treated as a missing value.
  }

  const announcement = {
    ...current.announcement,
    ...(body.announcement ?? {}),
  };
  const dialogs = Array.isArray(announcement.dialogs)
    ? announcement.dialogs.map((dialog, index) => ({
        id:
          typeof dialog?.id === "string" && dialog.id.trim()
            ? dialog.id.trim()
            : `dialog-${index + 1}`,
        enabled: dialog?.enabled !== false,
        title: String(dialog?.title ?? ""),
        text: String(dialog?.text ?? ""),
        contactLabel: String(dialog?.contactLabel ?? ""),
        contactUrl: String(dialog?.contactUrl ?? ""),
      }))
    : ([] as AnnouncementDialogItem[]);

  const saved = await writeAdsConfig({
    site: {
      siteName: String(body.site?.siteName ?? current.site.siteName),
      siteDescription: String(body.site?.siteDescription ?? current.site.siteDescription),
    },
    announcement: {
      enabled: Boolean(announcement.enabled),
      showDialog: announcement.showDialog !== false,
      dialogs,
      showInline: announcement.showInline !== false,
      text: String(announcement.text ?? ""),
      contactLabel: String(announcement.contactLabel ?? ""),
      contactUrl: String(announcement.contactUrl ?? ""),
      adsLabel: String(announcement.adsLabel ?? ""),
      adsContact: String(announcement.adsContact ?? ""),
      adsContactUrl: String(announcement.adsContactUrl ?? ""),
    },
    banners,
    network,
    updatedAt: new Date().toISOString(),
  });

  // Flush the layout + page cache so branding/announcement/banner changes are
  // visible to users on the very next request without waiting for TTL expiry.
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/favorites");
  revalidatePath("/history");

  return NextResponse.json(saved, {
    headers: { "Cache-Control": "no-store" },
  });
}
