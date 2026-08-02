"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  AD_SLOTS,
  EXOCLICK_INS_CLASS,
  NETWORK_SLOTS,
  isValidInsClass,
  isValidVerificationCode,
  isValidZoneId,
  type AdsConfig,
  type AdSlotId,
  type AnnouncementDialogItem,
  type NetworkSlotId,
  type NetworkZoneConfig,
} from "@/lib/ads-types";
import { adminApiUrl } from "@/lib/admin-path";

interface AdminAdsPanelProps {
  initial: AdsConfig;
}

export default function AdminAdsPanel({ initial }: AdminAdsPanelProps) {
  const router = useRouter();
  const [config, setConfig] = useState<AdsConfig>(initial);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<AdSlotId | null>(null);

  function updateAnnouncement<K extends keyof AdsConfig["announcement"]>(
    key: K,
    value: AdsConfig["announcement"][K],
  ) {
    setConfig((prev) => ({
      ...prev,
      announcement: { ...prev.announcement, [key]: value },
    }));
  }

  function updateBanner(slot: AdSlotId, patch: Partial<AdsConfig["banners"][AdSlotId]>) {
    setConfig((prev) => ({
      ...prev,
      banners: {
        ...prev.banners,
        [slot]: { ...prev.banners[slot], ...patch },
      },
    }));
  }

  function updateNetwork(patch: Partial<AdsConfig["network"]>) {
    setConfig((prev) => ({ ...prev, network: { ...prev.network, ...patch } }));
  }

  function updateZone(slot: NetworkSlotId, patch: Partial<NetworkZoneConfig>) {
    setConfig((prev) => ({
      ...prev,
      network: {
        ...prev.network,
        zones: { ...prev.network.zones, [slot]: { ...prev.network.zones[slot], ...patch } },
      },
    }));
  }

  function updateDialog(
    dialogId: string,
    patch: Partial<AnnouncementDialogItem>,
  ) {
    setConfig((prev) => ({
      ...prev,
      announcement: {
        ...prev.announcement,
        dialogs: prev.announcement.dialogs.map((dialog) =>
          dialog.id === dialogId ? { ...dialog, ...patch } : dialog,
        ),
      },
    }));
  }

  function addDialog() {
    setConfig((prev) => ({
      ...prev,
      announcement: {
        ...prev.announcement,
        dialogs: [
          ...prev.announcement.dialogs,
          {
            id: `dialog-${Date.now()}`,
            enabled: true,
            title: "",
            text: "",
            contactLabel: "",
            contactUrl: "",
          },
        ],
      },
    }));
  }

  function removeDialog(dialogId: string) {
    setConfig((prev) => ({
      ...prev,
      announcement: {
        ...prev.announcement,
        dialogs: prev.announcement.dialogs.filter((dialog) => dialog.id !== dialogId),
      },
    }));
  }

  async function onUpload(slot: AdSlotId, file: File | undefined) {
    if (!file) return;
    setUploading(slot);
    setStatus("");
    try {
      const res = await fetch(adminApiUrl("/upload"), {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-Upload-Filename": file.name,
          "X-Upload-Type": file.type || "application/octet-stream",
          "X-Upload-Slot": slot,
        },
        body: file,
      });
      const data = (await res.json()) as { imageUrl?: string; error?: string };
      if (!res.ok || !data.imageUrl) {
        setStatus(data.error || "Upload failed");
        return;
      }
      updateBanner(slot, { imageUrl: data.imageUrl, enabled: true });
      setStatus(`Uploaded for ${slot}`);
    } catch {
      setStatus("Upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      const res = await fetch(adminApiUrl("/ads"), {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        setStatus("Save failed");
        return;
      }
      const saved = (await res.json()) as AdsConfig;
      setConfig(saved);
      setStatus("Saved");
      router.refresh();
    } catch {
      setStatus("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch(adminApiUrl("/login"), { method: "DELETE", credentials: "same-origin" });
    router.refresh();
  }

  return (
    <form onSubmit={onSave} className="mx-auto max-w-3xl space-y-8 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-100">Ads & announcement</h1>
          <p className="mt-1 text-sm text-ink-400">
            Control home announcement and GIF banners for each placement.
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-md border border-ink-700 px-3 py-1.5 text-sm text-ink-300 hover:border-ink-600 hover:text-ink-100"
        >
          Log out
        </button>
      </div>

      <section className="rounded-lg border border-ink-700 bg-ink-900 p-4 sm:p-5">
        <h2 className="font-semibold text-ink-100">Site branding</h2>
        <p className="mt-1 text-sm text-ink-400">
          This name is used in the header, footer, and browser page title for this site only.
        </p>

        <label className="mt-4 block text-sm text-ink-300">
          Site name
          <input
            value={config.site.siteName}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                site: { ...prev.site, siteName: e.target.value },
              }))
            }
            placeholder="AkoGyi Vip"
            className="mt-1.5 w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-brand-500"
          />
        </label>

        <label className="mt-4 block text-sm text-ink-300">
          Site description
          <textarea
            value={config.site.siteDescription}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                site: { ...prev.site, siteDescription: e.target.value },
              }))
            }
            rows={3}
            placeholder="Describe this site for Telegram preview and SEO"
            className="mt-1.5 w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-brand-500"
          />
        </label>
      </section>

      <section className="rounded-lg border border-ink-700 bg-ink-900 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-ink-100">Home announcement</h2>
          <div className="flex flex-wrap items-center gap-4 text-sm text-ink-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.announcement.enabled}
                onChange={(e) => updateAnnouncement("enabled", e.target.checked)}
              />
              Enabled
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.announcement.showDialog}
                onChange={(e) => updateAnnouncement("showDialog", e.target.checked)}
              />
              First-load dialog
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.announcement.showInline}
                onChange={(e) => updateAnnouncement("showInline", e.target.checked)}
              />
              Inline banner
            </label>
          </div>
        </div>

        <label className="mt-4 block text-sm text-ink-300">
          Message
          <textarea
            value={config.announcement.text}
            onChange={(e) => updateAnnouncement("text", e.target.value)}
            rows={5}
            className="mt-1.5 w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-brand-500"
          />
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-ink-300">
            Contact label
            <input
              value={config.announcement.contactLabel}
              onChange={(e) => updateAnnouncement("contactLabel", e.target.value)}
              className="mt-1.5 w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-brand-500"
            />
          </label>
          <label className="block text-sm text-ink-300">
            Contact URL (Telegram)
            <input
              value={config.announcement.contactUrl}
              onChange={(e) => updateAnnouncement("contactUrl", e.target.value)}
              placeholder="https://t.me/VVIPMEMEBR"
              className="mt-1.5 w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-brand-500"
            />
          </label>
          <label className="block text-sm text-ink-300">
            Ads CTA label
            <input
              value={config.announcement.adsLabel}
              onChange={(e) => updateAnnouncement("adsLabel", e.target.value)}
              className="mt-1.5 w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-brand-500"
            />
          </label>
          <label className="block text-sm text-ink-300">
            Ads contact handle
            <input
              value={config.announcement.adsContact}
              onChange={(e) => updateAnnouncement("adsContact", e.target.value)}
              className="mt-1.5 w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-brand-500"
            />
          </label>
          <label className="block text-sm text-ink-300 sm:col-span-2">
            Ads contact URL
            <input
              value={config.announcement.adsContactUrl}
              onChange={(e) => updateAnnouncement("adsContactUrl", e.target.value)}
              className="mt-1.5 w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-brand-500"
            />
          </label>
        </div>

        <div className="mt-5 border-t border-ink-700 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-medium text-ink-100">Popup dialogs</h3>
              <p className="mt-1 text-xs text-ink-400">
                Add multiple popup announcements. They show in sequence on each page load.
              </p>
            </div>
            <button
              type="button"
              onClick={addDialog}
              className="rounded-md border border-ink-700 px-3 py-1.5 text-sm text-ink-200 hover:bg-ink-800"
            >
              Add dialog
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {config.announcement.dialogs.map((dialog, idx) => (
              <div key={dialog.id} className="rounded-md border border-ink-700 bg-ink-950 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-100">Dialog {idx + 1}</p>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-ink-300">
                      <input
                        type="checkbox"
                        checked={dialog.enabled}
                        onChange={(e) => updateDialog(dialog.id, { enabled: e.target.checked })}
                      />
                      Enabled
                    </label>
                    <button
                      type="button"
                      onClick={() => removeDialog(dialog.id)}
                      className="text-sm text-red-300 hover:text-red-200"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm text-ink-300 sm:col-span-2">
                    Title
                    <input
                      value={dialog.title}
                      onChange={(e) => updateDialog(dialog.id, { title: e.target.value })}
                      placeholder="VIP Announcement"
                      className="mt-1.5 w-full rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 outline-none focus:border-brand-500"
                    />
                  </label>
                  <label className="block text-sm text-ink-300 sm:col-span-2">
                    Message
                    <textarea
                      value={dialog.text}
                      onChange={(e) => updateDialog(dialog.id, { text: e.target.value })}
                      rows={4}
                      className="mt-1.5 w-full rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 outline-none focus:border-brand-500"
                    />
                  </label>
                  <label className="block text-sm text-ink-300">
                    Contact label
                    <input
                      value={dialog.contactLabel}
                      onChange={(e) =>
                        updateDialog(dialog.id, { contactLabel: e.target.value })
                      }
                      className="mt-1.5 w-full rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 outline-none focus:border-brand-500"
                    />
                  </label>
                  <label className="block text-sm text-ink-300">
                    Contact URL
                    <input
                      value={dialog.contactUrl}
                      onChange={(e) => updateDialog(dialog.id, { contactUrl: e.target.value })}
                      placeholder="https://t.me/..."
                      className="mt-1.5 w-full rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 outline-none focus:border-brand-500"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {AD_SLOTS.map((slot) => {
        const banner = config.banners[slot.id];
        return (
          <section
            key={slot.id}
            className="rounded-lg border border-ink-700 bg-ink-900 p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ink-100">{slot.label}</h2>
                <p className="text-xs text-ink-400">{slot.description}</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-300">
                <input
                  type="checkbox"
                  checked={banner.enabled}
                  onChange={(e) => updateBanner(slot.id, { enabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>

            <label className="mt-4 block text-sm text-ink-300">
              Upload GIF / image
              <input
                type="file"
                accept="image/gif,image/jpeg,image/png,image/webp"
                onChange={(e) => onUpload(slot.id, e.target.files?.[0])}
                className="mt-1.5 block w-full text-sm text-ink-400 file:mr-3 file:rounded-md file:border-0 file:bg-ink-800 file:px-3 file:py-1.5 file:text-ink-100"
              />
              <span className="mt-1 block text-xs text-ink-400">
                Max 100MB. A successful upload will auto-fill the Image URL below.
              </span>
              {uploading === slot.id && (
                <span className="mt-1 block text-xs text-brand-500">Uploading…</span>
              )}
            </label>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-ink-300 sm:col-span-2">
                Image URL
                <input
                  value={banner.imageUrl}
                  onChange={(e) => updateBanner(slot.id, { imageUrl: e.target.value })}
                  placeholder="/uploads/ads/…"
                  className="mt-1.5 w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-brand-500"
                />
              </label>
              <label className="block text-sm text-ink-300">
                Click URL
                <input
                  value={banner.linkUrl}
                  onChange={(e) => updateBanner(slot.id, { linkUrl: e.target.value })}
                  placeholder="https://…"
                  className="mt-1.5 w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-brand-500"
                />
              </label>
              <label className="block text-sm text-ink-300">
                Alt text
                <input
                  value={banner.alt}
                  onChange={(e) => updateBanner(slot.id, { alt: e.target.value })}
                  className="mt-1.5 w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-brand-500"
                />
              </label>
            </div>

            {banner.imageUrl && (
              <div className="mt-4 overflow-hidden rounded-md border border-ink-700 bg-ink-950 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={banner.imageUrl}
                  alt={banner.alt || "Preview"}
                  className="mx-auto max-h-36 object-contain"
                />
              </div>
            )}
          </section>
        );
      })}

      {/* ExoClick — a separate layer from the GIF banners above. Turning the
          master switch off removes every zone and the provider script. */}
      <section className="rounded-lg border border-ink-700 bg-ink-900 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-ink-100">ExoClick ad network</h2>
            <p className="text-xs text-ink-400">
              Runs alongside your own banners. Paste the numeric Zone ID from your ExoClick
              dashboard.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-300">
            <input
              type="checkbox"
              checked={config.network.enabled}
              onChange={(e) => updateNetwork({ enabled: e.target.checked })}
            />
            Enabled
          </label>
        </div>

        {!config.network.enabled && (
          <p className="mt-3 rounded-md bg-ink-950 px-3 py-2 text-xs text-ink-400">
            Network is off — no ExoClick script is loaded and no zones render.
          </p>
        )}

        <label className="mt-4 block text-sm text-ink-300">
          Site verification code
          <input
            value={config.network.verificationCode}
            onChange={(e) => updateNetwork({ verificationCode: e.target.value.trim() })}
            placeholder="e.g. 9e5af7e18cb507949c6bf66b6b29ccb8"
            className={`mt-1.5 w-full rounded-md border bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-brand-500 ${
              config.network.verificationCode &&
              !isValidVerificationCode(config.network.verificationCode)
                ? "border-red-500"
                : "border-ink-700"
            }`}
          />
          <span className="mt-1 block text-xs text-ink-400">
            From ExoClick → Site Verification → HTML Meta Tag. Paste only the{" "}
            <code className="text-ink-300">content</code> value, not the whole tag. Works even
            while the network above is off — verify ownership first, then create zones.
          </span>
        </label>

        <div className="mt-4 grid gap-3">
          {NETWORK_SLOTS.map((slot) => {
            const zone = config.network.zones[slot.id];
            const invalid = zone.zoneId !== "" && !isValidZoneId(zone.zoneId);
            return (
              <div key={slot.id} className="rounded-md border border-ink-700 bg-ink-950 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink-100">{slot.label}</p>
                    <p className="text-xs text-ink-400">{slot.description}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-ink-300">
                    <input
                      type="checkbox"
                      checked={zone.enabled}
                      onChange={(e) => updateZone(slot.id, { enabled: e.target.checked })}
                    />
                    Show
                  </label>
                </div>
                <label className="mt-2 block text-sm text-ink-300">
                  Zone ID
                  <input
                    value={zone.zoneId}
                    inputMode="numeric"
                    onChange={(e) => updateZone(slot.id, { zoneId: e.target.value.trim() })}
                    placeholder="e.g. 5990052"
                    className={`mt-1.5 w-full rounded-md border bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-brand-500 ${
                      invalid ? "border-red-500" : "border-ink-700"
                    }`}
                  />
                  {invalid && (
                    <span className="mt-1 block text-xs text-red-400">
                      Numbers only — this is discarded on save.
                    </span>
                  )}
                </label>
                <label className="mt-2 block text-sm text-ink-300">
                  Ad tag class{" "}
                  <span className="text-ink-400">(from ExoClick &lt;ins class=&quot;…&quot;&gt;)</span>
                  <input
                    value={zone.insClass ?? ""}
                    onChange={(e) => updateZone(slot.id, { insClass: e.target.value.trim() })}
                    placeholder={
                      slot.id.includes("interstitial")
                        ? "e.g. eas6a97888e35"
                        : EXOCLICK_INS_CLASS
                    }
                    className={`mt-1.5 w-full rounded-md border bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-brand-500 ${
                      zone.insClass && !isValidInsClass(zone.insClass)
                        ? "border-red-500"
                        : "border-ink-700"
                    }`}
                  />
                  <span className="mt-1 block text-xs text-ink-400">
                    Copy exactly from this zone&apos;s HTML tag. Each zone can have a different
                    class — mismatch = blank ads, no error.
                  </span>
                </label>
              </div>
            );
          })}
        </div>

        <label className="mt-4 block text-sm text-ink-300">
          Default ad tag class{" "}
          <span className="text-ink-400">(fallback only — prefer per-zone class above)</span>
          <input
            value={config.network.insClass}
            onChange={(e) => updateNetwork({ insClass: e.target.value.trim() })}
            placeholder={EXOCLICK_INS_CLASS}
            className={`mt-1.5 w-full rounded-md border bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-brand-500 ${
              config.network.insClass && !isValidInsClass(config.network.insClass)
                ? "border-red-500"
                : "border-ink-700"
            }`}
          />
          <span className="mt-1 block text-xs text-ink-400">
            Used only when a zone&apos;s own Ad tag class is empty. Defaults to{" "}
            <code className="text-ink-300">{EXOCLICK_INS_CLASS}</code>.
          </span>
        </label>

        <p className="mt-4 rounded-md bg-ink-950 px-3 py-2 text-xs text-ink-400">
          Paste Zone ID + Ad tag class from each ExoClick zone&apos;s HTML tag. Example: Desktop
          Interstitial often uses class <code className="text-ink-300">eas6a97888e35</code> while
          Mobile uses <code className="text-ink-300">eas6a97888e33</code> and banners use{" "}
          <code className="text-ink-300">eas6a97888e2</code> — they are not interchangeable.
          In-Page Push loads on every page; set its corner position in ExoClick (Horizontal /
          Vertical Position), not here.
          Interstitials fire when a visitor clicks a video from home / category / search.
          The app re-arms the tag on every listing visit. If it still only shows{" "}
          <strong className="text-ink-300">once per day</strong>, open the zone in ExoClick →{" "}
          <strong className="text-ink-300">Capping / Frequency</strong> and lower it (e.g. every
          click, or 1× per 5–15 minutes). Server-side capping cannot be overridden from this site.
        </p>

        <div className="mt-4 space-y-3 rounded-md border border-ink-800 bg-ink-950/50 p-3">
          <label className="flex items-center gap-2 text-sm text-ink-200">
            <input
              type="checkbox"
              checked={config.network.popunderEnabled}
              onChange={(e) => updateNetwork({ popunderEnabled: e.target.checked })}
              className="rounded border-ink-600"
            />
            Enable Popunder
          </label>
          <label className="block text-sm text-ink-300">
            Popunder Zone ID
            <input
              value={config.network.popunderZoneId}
              inputMode="numeric"
              onChange={(e) => updateNetwork({ popunderZoneId: e.target.value.trim() })}
              placeholder="Digits from ExoClick Popunder zone"
              className={`mt-1.5 w-full rounded-md border bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-brand-500 ${
                config.network.popunderEnabled && !config.network.popunderZoneId
                  ? "border-amber-500"
                  : "border-ink-700"
              }`}
            />
          </label>
          <p className="text-xs text-ink-400">
            Fires when a visitor clicks a video card (<code className="text-ink-300">exo-int-trigger</code>
            ). Create a Popunder zone in ExoClick, paste only the Zone ID here (e.g.{" "}
            <code className="text-ink-300">5992792</code>) — do not paste the full script. Turn this on,
            keep the network master switch on, and set capping in ExoClick (e.g. 1×/hour) so it
            doesn&apos;t stack too hard with interstitials.
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 pb-10">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-brand-400 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {status && <p className="text-sm text-ink-300">{status}</p>}
      </div>
    </form>
  );
}
