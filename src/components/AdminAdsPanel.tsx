"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminAnalyticsPanel from "@/components/AdminAnalyticsPanel";
import AdminAdsterraStats from "@/components/AdminAdsterraStats";
import AdminShell, { type AdminNavItem } from "@/components/AdminShell";
import {
  ADSTERRA_BANNER_SLOTS,
  AD_SLOTS,
  EXOCLICK_INS_CLASS,
  NETWORK_SLOTS,
  extractAdsterraScriptSrc,
  isValidInsClass,
  isValidVerificationCode,
  isValidZoneId,
  type AdsConfig,
  type AdSlotId,
  type AdsterraBannerSlotId,
  type AdsterraBannerUnit,
  type AdsterraScript,
  type AnnouncementDialogItem,
  type NetworkSlotId,
  type NetworkZoneConfig,
} from "@/lib/ads-types";
import { slugifyCategory, type Category } from "@/lib/categories";
import { SORT_ORDERS } from "@/lib/eporner";
import { adminApiUrl } from "@/lib/admin-path";

interface AdminAdsPanelProps {
  initial: AdsConfig;
}

const NAV: AdminNavItem[] = [
  { id: "traffic", label: "Traffic" },
  { id: "adsterra-stats", label: "Adsterra stats" },
  { id: "site", label: "Site" },
  { id: "feed", label: "Video feed" },
  { id: "vpn", label: "VPN wall" },
  { id: "announcement", label: "Announcement" },
  { id: "banners", label: "GIF banners" },
  { id: "exoclick", label: "ExoClick" },
  { id: "adsterra", label: "Adsterra" },
];

const field =
  "mt-1.5 w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-brand-500";
const fieldSm =
  "mt-1 w-full rounded-md border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-ink-100 outline-none focus:border-brand-500";
const panel = "rounded-lg border border-ink-700 bg-ink-900 p-4 sm:p-5";
const labelCls = "block text-sm text-ink-300";

export default function AdminAdsPanel({ initial }: AdminAdsPanelProps) {
  const router = useRouter();
  const [config, setConfig] = useState<AdsConfig>(() => ({
    ...initial,
    adsterra: {
      ...initial.adsterra,
      apiKey: "",
    },
  }));
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [apiKeySet, setApiKeySet] = useState(
    Boolean((initial.adsterra as { apiKeySet?: boolean })?.apiKeySet || initial.adsterra?.apiKey),
  );
  const [adsterraDomains, setAdsterraDomains] = useState<{ id: number; title: string }[]>([]);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<AdSlotId | null>(null);
  const [section, setSection] = useState(NAV[0].id);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (section !== "adsterra" && section !== "adsterra-stats") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${adminApiUrl("/adsterra-stats")}?range=1&group_by=date`, {
          credentials: "same-origin",
        });
        if (!res.ok) {
          // Still try domain list from error payload when NO_DOMAIN
          const json = (await res.json().catch(() => null)) as {
            domains?: { id: number; title: string }[];
          } | null;
          if (!cancelled && Array.isArray(json?.domains)) setAdsterraDomains(json.domains);
          return;
        }
        const json = (await res.json()) as { domains?: { id: number; title: string }[] };
        if (!cancelled && Array.isArray(json.domains)) setAdsterraDomains(json.domains);
      } catch {
        /* ignore — stats page may still work via its own fetch */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section]);

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

  function updateAdsterra(patch: Partial<AdsConfig["adsterra"]>) {
    setConfig((prev) => ({ ...prev, adsterra: { ...prev.adsterra, ...patch } }));
  }

  function updateAdsterraScript(index: number, patch: Partial<AdsterraScript>) {
    setConfig((prev) => {
      const scripts = prev.adsterra.scripts.map((s, i) => {
        if (i !== index) return s;
        const next = { ...s, ...patch };
        if (patch.src !== undefined) {
          next.src = extractAdsterraScriptSrc(patch.src);
        }
        return next;
      });
      return { ...prev, adsterra: { ...prev.adsterra, scripts } };
    });
  }

  function addAdsterraScript() {
    setConfig((prev) => ({
      ...prev,
      adsterra: {
        ...prev.adsterra,
        scripts: [
          ...prev.adsterra.scripts,
          {
            id: `script-${prev.adsterra.scripts.length + 1}`,
            enabled: false,
            label: "New script",
            src: "",
          },
        ].slice(0, 8),
      },
    }));
  }

  function removeAdsterraScript(index: number) {
    setConfig((prev) => ({
      ...prev,
      adsterra: {
        ...prev.adsterra,
        scripts: prev.adsterra.scripts.filter((_, i) => i !== index),
      },
    }));
  }

  function updateAdsterraBanner(
    slot: AdsterraBannerSlotId,
    patch: Partial<AdsterraBannerUnit>,
  ) {
    setConfig((prev) => ({
      ...prev,
      adsterra: {
        ...prev.adsterra,
        banners: {
          ...prev.adsterra.banners,
          [slot]: { ...prev.adsterra.banners[slot], ...patch },
        },
      },
    }));
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

  function updateFeed(patch: Partial<AdsConfig["feed"]>) {
    setConfig((prev) => ({ ...prev, feed: { ...prev.feed, ...patch } }));
  }

  function updateCategory(index: number, patch: Partial<Category>) {
    setConfig((prev) => {
      const categories = prev.feed.categories.map((cat, i) => {
        if (i !== index) return cat;
        const next = { ...cat, ...patch };
        if (patch.label !== undefined && !patch.slug) {
          next.slug = slugifyCategory(patch.label);
        }
        if (patch.query === undefined && patch.label !== undefined && !cat.query) {
          next.query = patch.label.trim().toLowerCase();
        }
        return next;
      });
      return { ...prev, feed: { ...prev.feed, categories } };
    });
  }

  function addCategory() {
    setConfig((prev) => ({
      ...prev,
      feed: {
        ...prev.feed,
        categories: [
          ...prev.feed.categories,
          {
            slug: `category-${prev.feed.categories.length + 1}`,
            label: "New category",
            query: "",
            description: "",
          },
        ],
      },
    }));
  }

  function removeCategory(index: number) {
    setConfig((prev) => ({
      ...prev,
      feed: {
        ...prev.feed,
        categories: prev.feed.categories.filter((_, i) => i !== index),
      },
    }));
  }

  function moveCategory(index: number, dir: -1 | 1) {
    setConfig((prev) => {
      const next = [...prev.feed.categories];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, feed: { ...prev.feed, categories: next } };
    });
  }

  function updateDialog(dialogId: string, patch: Partial<AnnouncementDialogItem>) {
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
      setStatus("Uploaded");
    } catch {
      setStatus("Upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function onSave(e?: FormEvent) {
    e?.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      const payload = {
        ...config,
        adsterra: {
          ...config.adsterra,
          // Only send a new key when the admin typed one; empty keeps existing.
          apiKey: apiKeyDraft.trim(),
        },
      };
      const res = await fetch(adminApiUrl("/ads"), {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setStatus("Save failed");
        return;
      }
      const saved = (await res.json()) as AdsConfig & {
        adsterra: AdsConfig["adsterra"] & { apiKeySet?: boolean };
      };
      setConfig({
        ...saved,
        adsterra: { ...saved.adsterra, apiKey: "" },
      });
      if (apiKeyDraft.trim()) setApiKeySet(true);
      if (typeof saved.adsterra?.apiKeySet === "boolean") {
        setApiKeySet(saved.adsterra.apiKeySet);
      }
      setApiKeyDraft("");
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

  const showSave = section !== "traffic" && section !== "adsterra-stats";

  return (
    <AdminShell
      title="Admin"
      nav={NAV}
      activeId={section}
      onNavigate={setSection}
      onLogout={logout}
      menuOpen={menuOpen}
      onMenuOpenChange={setMenuOpen}
      headerActions={
        showSave ? (
          <div className="flex shrink-0 items-center gap-2">
            {status ? <span className="hidden text-xs text-ink-400 sm:inline">{status}</span> : null}
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving}
              className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-bold text-black hover:bg-brand-400 disabled:opacity-60 sm:px-4"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        ) : null
      }
    >
      <form onSubmit={onSave} className="mx-auto max-w-3xl space-y-4 pb-16">
        {section === "traffic" && <AdminAnalyticsPanel />}

        {section === "adsterra-stats" && (
          <section className={panel}>
            <AdminAdsterraStats />
          </section>
        )}

        {section === "site" && (
          <section className={panel}>
            <label className={labelCls}>
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
                className={field}
              />
            </label>
            <label className={`mt-4 ${labelCls}`}>
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
                className={field}
              />
            </label>

            <h3 className="mt-5 text-sm font-semibold text-ink-100">Theme colors</h3>
            <p className="mt-1 text-xs text-ink-500">
              Background defaults to black. Surfaces and muted text derive from these two
              colors automatically.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={labelCls}>
                Background
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="color"
                    value={config.site.backgroundColor || "#0a0a0a"}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        site: { ...prev.site, backgroundColor: e.target.value },
                      }))
                    }
                    className="h-10 w-12 cursor-pointer rounded border border-ink-700 bg-transparent"
                  />
                  <input
                    value={config.site.backgroundColor || "#0a0a0a"}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        site: { ...prev.site, backgroundColor: e.target.value },
                      }))
                    }
                    placeholder="#0a0a0a"
                    className={field.replace("mt-1.5 ", "")}
                  />
                </div>
              </label>
              <label className={labelCls}>
                Text
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="color"
                    value={config.site.textColor || "#e6e6e6"}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        site: { ...prev.site, textColor: e.target.value },
                      }))
                    }
                    className="h-10 w-12 cursor-pointer rounded border border-ink-700 bg-transparent"
                  />
                  <input
                    value={config.site.textColor || "#e6e6e6"}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        site: { ...prev.site, textColor: e.target.value },
                      }))
                    }
                    placeholder="#e6e6e6"
                    className={field.replace("mt-1.5 ", "")}
                  />
                </div>
              </label>
            </div>
            <button
              type="button"
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  site: {
                    ...prev.site,
                    backgroundColor: "#0a0a0a",
                    textColor: "#e6e6e6",
                  },
                }))
              }
              className="mt-3 rounded-md border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-300 hover:border-brand-500 hover:text-brand-500"
            >
              Reset to default (black / light gray)
            </button>

            <div
              className="mt-4 overflow-hidden rounded-md border border-ink-700"
              style={{
                backgroundColor: config.site.backgroundColor || "#0a0a0a",
                color: config.site.textColor || "#e6e6e6",
              }}
            >
              <div className="px-3 py-3 text-sm font-semibold">Preview</div>
              <div
                className="border-t px-3 py-2 text-xs opacity-70"
                style={{ borderColor: "currentColor" }}
              >
                Sample muted text · cards and headers follow this theme after Save
              </div>
            </div>

            <label className={`mt-5 ${labelCls}`}>
              Player proxy mode
              <select
                value={config.playback?.proxyMode ?? "auto"}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    playback: {
                      ...prev.playback,
                      proxyMode: e.target.value as "off" | "always" | "auto",
                    },
                  }))
                }
                className={field}
              >
                <option value="auto">Auto — embed when possible, proxy if blocked</option>
                <option value="always">Always proxy (no VPN needed, uses VPS bandwidth)</option>
                <option value="off">Off — Eporner embed only (fast seek, may need VPN)</option>
              </select>
            </label>
          </section>
        )}

        {section === "feed" && (
          <section className={panel}>
            <div className="rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-xs text-ink-400">
              This site only. On <span className="text-ink-200">akogyivip</span> set home to
              Myanmar; on other sites pick a different category or query. Each admin saves to
              its own config.
            </div>

            <h3 className="mt-4 text-sm font-semibold text-ink-100">
              Home page — Trending Now
            </h3>
            <p className="mt-1 text-xs text-ink-500">
              Controls which videos appear in the main home grid.
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={labelCls}>
                Home video source
                <select
                  value={(() => {
                    const q = config.feed.homeQuery.trim().toLowerCase();
                    if (!q) return "__all__";
                    const match = config.feed.categories.find(
                      (c) => c.query.trim().toLowerCase() === q,
                    );
                    return match ? `cat:${match.slug}` : "__custom__";
                  })()}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__all__") {
                      updateFeed({ homeQuery: "" });
                      return;
                    }
                    if (v === "__custom__") {
                      if (
                        config.feed.categories.some(
                          (c) =>
                            c.query.trim().toLowerCase() ===
                            config.feed.homeQuery.trim().toLowerCase(),
                        ) ||
                        !config.feed.homeQuery.trim()
                      ) {
                        updateFeed({ homeQuery: "myanmar" });
                      }
                      return;
                    }
                    if (v.startsWith("cat:")) {
                      const slug = v.slice(4);
                      const cat = config.feed.categories.find((c) => c.slug === slug);
                      if (cat) {
                        updateFeed({
                          homeQuery: cat.query,
                          homeTitle: cat.label,
                        });
                      }
                    }
                  }}
                  className={field}
                >
                  <option value="__all__">All videos (no filter)</option>
                  {config.feed.categories.map((c) => (
                    <option key={c.slug} value={`cat:${c.slug}`}>
                      Category: {c.label} ({c.query})
                    </option>
                  ))}
                  <option value="__custom__">Custom search query…</option>
                </select>
              </label>

              <label className={labelCls}>
                Home sort order
                <select
                  value={config.feed.homeOrder}
                  onChange={(e) => updateFeed({ homeOrder: e.target.value })}
                  className={field}
                >
                  {SORT_ORDERS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={labelCls}>
                Video grid columns
                <select
                  value={config.feed.gridColumns === 1 ? "1" : "2"}
                  onChange={(e) =>
                    updateFeed({ gridColumns: e.target.value === "1" ? 1 : 2 })
                  }
                  className={field}
                >
                  <option value="2">2 columns</option>
                  <option value="1">1 column</option>
                </select>
                <span className="mt-1 block text-xs text-ink-500">
                  Applies to home, search, category, related, favorites, and history on
                  this site.
                </span>
              </label>

              {(() => {
                const q = config.feed.homeQuery.trim();
                const matched = config.feed.categories.some(
                  (c) => c.query.trim().toLowerCase() === q.toLowerCase(),
                );
                const isCustom = Boolean(q) && !matched;
                if (isCustom) {
                  return (
                    <label className={`${labelCls} sm:col-span-2`}>
                      Custom search query
                      <input
                        value={config.feed.homeQuery}
                        onChange={(e) => updateFeed({ homeQuery: e.target.value })}
                        placeholder="e.g. myanmar, japan, asian milf"
                        className={field}
                      />
                      <span className="mt-1 block text-xs text-ink-500">
                        Sent to Eporner as the home page search. Example:{" "}
                        <code className="text-ink-300">myanmar</code>
                      </span>
                    </label>
                  );
                }
                return (
                  <label className={`${labelCls} sm:col-span-2`}>
                    Active home query
                    <input
                      value={q || "(all videos)"}
                      readOnly
                      className={`${field} opacity-80`}
                    />
                  </label>
                );
              })()}

              <label className={labelCls}>
                Home title
                <input
                  value={config.feed.homeTitle}
                  onChange={(e) => updateFeed({ homeTitle: e.target.value })}
                  placeholder="Trending Now"
                  className={field}
                />
              </label>
              <label className={labelCls}>
                Home subtitle
                <input
                  value={config.feed.homeSubtitle}
                  onChange={(e) => updateFeed({ homeSubtitle: e.target.value })}
                  className={field}
                />
              </label>
            </div>

            <label className={`mt-3 ${labelCls}`}>
              Related fallback query
              <input
                value={config.feed.relatedFallbackQuery}
                onChange={(e) => updateFeed({ relatedFallbackQuery: e.target.value })}
                placeholder="asian"
                className={field}
              />
              <span className="mt-1 block text-xs text-ink-500">
                Used on video pages when a clip has no usable tags.
              </span>
            </label>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink-100">Nav categories</h3>
                <p className="mt-0.5 text-xs text-ink-500">
                  Header / mobile chips for this site. Use “Set as home” to drive Trending Now.
                </p>
              </div>
              <button
                type="button"
                onClick={addCategory}
                className="rounded-md border border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-300 hover:border-brand-500 hover:text-brand-500"
              >
                Add
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {config.feed.categories.map((cat, index) => {
                const isHome =
                  cat.query.trim().toLowerCase() ===
                    config.feed.homeQuery.trim().toLowerCase() &&
                  Boolean(config.feed.homeQuery.trim());
                return (
                  <div
                    key={`${cat.slug}-${index}`}
                    className={`rounded-md border bg-ink-950 p-3 ${
                      isHome ? "border-brand-500/60" : "border-ink-700"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium text-ink-400">
                        #{index + 1}
                        {isHome ? (
                          <span className="ml-2 text-brand-500">Home feed</span>
                        ) : null}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            updateFeed({
                              homeQuery: cat.query,
                              homeTitle: cat.label,
                              homeSubtitle: cat.description || config.feed.homeSubtitle,
                            })
                          }
                          className="rounded border border-ink-700 px-2 py-0.5 text-[11px] text-brand-500 hover:border-brand-500"
                        >
                          Set as home
                        </button>
                        <button
                          type="button"
                          onClick={() => moveCategory(index, -1)}
                          disabled={index === 0}
                          className="rounded border border-ink-700 px-2 py-0.5 text-[11px] text-ink-300 disabled:opacity-40"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveCategory(index, 1)}
                          disabled={index === config.feed.categories.length - 1}
                          className="rounded border border-ink-700 px-2 py-0.5 text-[11px] text-ink-300 disabled:opacity-40"
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCategory(index)}
                          className="rounded border border-red-900/60 px-2 py-0.5 text-[11px] text-red-400"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <label className="block text-xs text-ink-400">
                        Label
                        <input
                          value={cat.label}
                          onChange={(e) => updateCategory(index, { label: e.target.value })}
                          className={fieldSm}
                        />
                      </label>
                      <label className="block text-xs text-ink-400">
                        Query
                        <input
                          value={cat.query}
                          onChange={(e) => updateCategory(index, { query: e.target.value })}
                          className={fieldSm}
                        />
                      </label>
                      <label className="block text-xs text-ink-400">
                        Slug
                        <input
                          value={cat.slug}
                          onChange={(e) =>
                            updateCategory(index, { slug: slugifyCategory(e.target.value) })
                          }
                          className={fieldSm}
                        />
                      </label>
                    </div>
                    <label className="mt-2 block text-xs text-ink-400">
                      Description
                      <input
                        value={cat.description}
                        onChange={(e) => updateCategory(index, { description: e.target.value })}
                        className={fieldSm}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {section === "vpn" && (
          <section className={panel}>
            <label className="flex items-center gap-2 text-sm text-ink-300">
              <input
                type="checkbox"
                checked={config.vpnWall.enabled}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    vpnWall: { ...prev.vpnWall, enabled: e.target.checked },
                  }))
                }
              />
              Enabled
            </label>

            <label className={`mt-4 ${labelCls}`}>
              Blocked countries
              <input
                value={config.vpnWall.blockedCountries.join(", ")}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    vpnWall: {
                      ...prev.vpnWall,
                      blockedCountries: e.target.value
                        .split(/[\s,]+/)
                        .map((c) => c.trim().toUpperCase())
                        .filter(Boolean),
                    },
                  }))
                }
                placeholder="MM"
                className={field}
              />
            </label>

            <label className={`mt-3 ${labelCls}`}>
              Title
              <input
                value={config.vpnWall.title}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    vpnWall: { ...prev.vpnWall, title: e.target.value },
                  }))
                }
                className={field}
              />
            </label>

            <label className={`mt-3 ${labelCls}`}>
              Message
              <textarea
                value={config.vpnWall.message}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    vpnWall: { ...prev.vpnWall, message: e.target.value },
                  }))
                }
                rows={5}
                className={field}
              />
            </label>
          </section>
        )}

        {section === "announcement" && (
          <section className={panel}>
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
                Dialog
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.announcement.showInline}
                  onChange={(e) => updateAnnouncement("showInline", e.target.checked)}
                />
                Inline
              </label>
            </div>

            <label className={`mt-4 ${labelCls}`}>
              Message
              <textarea
                value={config.announcement.text}
                onChange={(e) => updateAnnouncement("text", e.target.value)}
                rows={5}
                className={field}
              />
            </label>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={labelCls}>
                Contact label
                <input
                  value={config.announcement.contactLabel}
                  onChange={(e) => updateAnnouncement("contactLabel", e.target.value)}
                  className={field}
                />
              </label>
              <label className={labelCls}>
                Contact URL
                <input
                  value={config.announcement.contactUrl}
                  onChange={(e) => updateAnnouncement("contactUrl", e.target.value)}
                  placeholder="https://t.me/…"
                  className={field}
                />
              </label>
              <label className={labelCls}>
                Ads CTA label
                <input
                  value={config.announcement.adsLabel}
                  onChange={(e) => updateAnnouncement("adsLabel", e.target.value)}
                  className={field}
                />
              </label>
              <label className={labelCls}>
                Ads contact
                <input
                  value={config.announcement.adsContact}
                  onChange={(e) => updateAnnouncement("adsContact", e.target.value)}
                  className={field}
                />
              </label>
              <label className={`${labelCls} sm:col-span-2`}>
                Ads contact URL
                <input
                  value={config.announcement.adsContactUrl}
                  onChange={(e) => updateAnnouncement("adsContactUrl", e.target.value)}
                  className={field}
                />
              </label>
            </div>

            <div className="mt-5 border-t border-ink-700 pt-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-ink-100">Popup dialogs</h3>
                <button
                  type="button"
                  onClick={addDialog}
                  className="rounded-md border border-ink-700 px-3 py-1.5 text-sm text-ink-200 hover:bg-ink-800"
                >
                  Add
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
                            onChange={(e) =>
                              updateDialog(dialog.id, { enabled: e.target.checked })
                            }
                          />
                          On
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
                      <label className={`${labelCls} sm:col-span-2`}>
                        Title
                        <input
                          value={dialog.title}
                          onChange={(e) => updateDialog(dialog.id, { title: e.target.value })}
                          className={field.replace("bg-ink-950", "bg-ink-900")}
                        />
                      </label>
                      <label className={`${labelCls} sm:col-span-2`}>
                        Message
                        <textarea
                          value={dialog.text}
                          onChange={(e) => updateDialog(dialog.id, { text: e.target.value })}
                          rows={4}
                          className={field.replace("bg-ink-950", "bg-ink-900")}
                        />
                      </label>
                      <label className={labelCls}>
                        Contact label
                        <input
                          value={dialog.contactLabel}
                          onChange={(e) =>
                            updateDialog(dialog.id, { contactLabel: e.target.value })
                          }
                          className={field.replace("bg-ink-950", "bg-ink-900")}
                        />
                      </label>
                      <label className={labelCls}>
                        Contact URL
                        <input
                          value={dialog.contactUrl}
                          onChange={(e) =>
                            updateDialog(dialog.id, { contactUrl: e.target.value })
                          }
                          className={field.replace("bg-ink-950", "bg-ink-900")}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {section === "banners" &&
          AD_SLOTS.map((slot) => {
            const banner = config.banners[slot.id];
            return (
              <section key={slot.id} className={panel}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-semibold text-ink-100">{slot.label}</h2>
                  <label className="flex items-center gap-2 text-sm text-ink-300">
                    <input
                      type="checkbox"
                      checked={banner.enabled}
                      onChange={(e) => updateBanner(slot.id, { enabled: e.target.checked })}
                    />
                    Enabled
                  </label>
                </div>

                <label className={`mt-4 ${labelCls}`}>
                  Upload
                  <input
                    type="file"
                    accept="image/gif,image/jpeg,image/png,image/webp"
                    onChange={(e) => onUpload(slot.id, e.target.files?.[0])}
                    className="mt-1.5 block w-full text-sm text-ink-400 file:mr-3 file:rounded-md file:border-0 file:bg-ink-800 file:px-3 file:py-1.5 file:text-ink-100"
                  />
                  {uploading === slot.id && (
                    <span className="mt-1 block text-xs text-brand-500">Uploading…</span>
                  )}
                </label>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className={`${labelCls} sm:col-span-2`}>
                    Image URL
                    <input
                      value={banner.imageUrl}
                      onChange={(e) => updateBanner(slot.id, { imageUrl: e.target.value })}
                      placeholder="/uploads/ads/…"
                      className={field}
                    />
                  </label>
                  <label className={labelCls}>
                    Click URL
                    <input
                      value={banner.linkUrl}
                      onChange={(e) => updateBanner(slot.id, { linkUrl: e.target.value })}
                      placeholder="https://…"
                      className={field}
                    />
                  </label>
                  <label className={labelCls}>
                    Alt text
                    <input
                      value={banner.alt}
                      onChange={(e) => updateBanner(slot.id, { alt: e.target.value })}
                      className={field}
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

        {section === "exoclick" && (
          <section className={panel}>
            <label className="flex items-center gap-2 text-sm text-ink-300">
              <input
                type="checkbox"
                checked={config.network.enabled}
                onChange={(e) => updateNetwork({ enabled: e.target.checked })}
              />
              Enabled
            </label>

            <label className={`mt-4 ${labelCls}`}>
              Verification code
              <input
                value={config.network.verificationCode}
                onChange={(e) => updateNetwork({ verificationCode: e.target.value.trim() })}
                className={`${field} ${
                  config.network.verificationCode &&
                  !isValidVerificationCode(config.network.verificationCode)
                    ? "border-red-500"
                    : ""
                }`}
              />
            </label>

            <div className="mt-4 grid gap-3">
              {NETWORK_SLOTS.map((slot) => {
                const zone = config.network.zones[slot.id];
                const invalid = zone.zoneId !== "" && !isValidZoneId(zone.zoneId);
                return (
                  <div key={slot.id} className="rounded-md border border-ink-700 bg-ink-950 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink-100">{slot.label}</p>
                      <label className="flex items-center gap-2 text-sm text-ink-300">
                        <input
                          type="checkbox"
                          checked={zone.enabled}
                          onChange={(e) => updateZone(slot.id, { enabled: e.target.checked })}
                        />
                        Show
                      </label>
                    </div>
                    <label className={`mt-2 ${labelCls}`}>
                      Zone ID
                      <input
                        value={zone.zoneId}
                        inputMode="numeric"
                        onChange={(e) => updateZone(slot.id, { zoneId: e.target.value.trim() })}
                        className={`${field} ${invalid ? "border-red-500" : ""}`}
                      />
                    </label>
                    <label className={`mt-2 ${labelCls}`}>
                      Ad tag class
                      <input
                        value={zone.insClass ?? ""}
                        onChange={(e) => updateZone(slot.id, { insClass: e.target.value.trim() })}
                        placeholder={
                          slot.id.includes("interstitial")
                            ? "e.g. eas6a97888e35"
                            : EXOCLICK_INS_CLASS
                        }
                        className={`${field} ${
                          zone.insClass && !isValidInsClass(zone.insClass)
                            ? "border-red-500"
                            : ""
                        }`}
                      />
                    </label>
                  </div>
                );
              })}
            </div>

            <label className={`mt-4 ${labelCls}`}>
              Default ad tag class
              <input
                value={config.network.insClass}
                onChange={(e) => updateNetwork({ insClass: e.target.value.trim() })}
                placeholder={EXOCLICK_INS_CLASS}
                className={`${field} ${
                  config.network.insClass && !isValidInsClass(config.network.insClass)
                    ? "border-red-500"
                    : ""
                }`}
              />
            </label>

            <div className="mt-4 space-y-3 rounded-md border border-ink-800 bg-ink-950/50 p-3">
              <label className="flex items-center gap-2 text-sm text-ink-200">
                <input
                  type="checkbox"
                  checked={config.network.popunderEnabled}
                  onChange={(e) => updateNetwork({ popunderEnabled: e.target.checked })}
                  className="rounded border-ink-600"
                />
                Popunder
              </label>
              <label className={labelCls}>
                Popunder Zone ID
                <input
                  value={config.network.popunderZoneId}
                  inputMode="numeric"
                  onChange={(e) => updateNetwork({ popunderZoneId: e.target.value.trim() })}
                  className={field}
                />
              </label>
            </div>
          </section>
        )}

        {section === "adsterra" && (
          <section className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-ink-300">
                <input
                  type="checkbox"
                  checked={config.adsterra.enabled}
                  onChange={(e) => updateAdsterra({ enabled: e.target.checked })}
                />
                Enabled
              </label>
              <button
                type="button"
                onClick={addAdsterraScript}
                className="rounded-md border border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-300 hover:border-brand-500 hover:text-brand-500"
              >
                Add script
              </button>
            </div>

            <label className={`mt-4 ${labelCls}`}>
              Publisher API key
              <input
                type="password"
                value={apiKeyDraft}
                onChange={(e) => setApiKeyDraft(e.target.value)}
                placeholder={apiKeySet ? "•••••••• (saved — paste to replace)" : "Paste Adsterra API token"}
                autoComplete="off"
                className={field}
              />
              <span className="mt-1 block text-xs text-ink-500">
                From Adsterra → Settings → API. Or set ADSTERRA_API_KEY in .env
              </span>
            </label>

            <label className={`mt-4 ${labelCls}`}>
              Stats website (this admin)
              <select
                value={config.adsterra.statsDomainId || ""}
                onChange={(e) => updateAdsterra({ statsDomainId: e.target.value })}
                className={field}
              >
                <option value="">Auto — match from site URL</option>
                {adsterraDomains.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.title}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-ink-500">
                Each site admin shows only this domain’s stats. Leave Auto if{" "}
                <code className="text-ink-400">NEXT_PUBLIC_SITE_URL</code> matches the
                Adsterra website name (luugyizcar / akogyivip).
              </span>
            </label>

            <div className="mt-4 space-y-3">
              {config.adsterra.scripts.map((script, index) => (
                <div
                  key={`${script.id}-${index}`}
                  className="rounded-md border border-ink-700 bg-ink-950 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm text-ink-300">
                      <input
                        type="checkbox"
                        checked={script.enabled}
                        onChange={(e) =>
                          updateAdsterraScript(index, { enabled: e.target.checked })
                        }
                      />
                      Show
                    </label>
                    <button
                      type="button"
                      onClick={() => removeAdsterraScript(index)}
                      className="rounded border border-red-900/60 px-2 py-0.5 text-[11px] text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="block text-xs text-ink-400">
                      Label
                      <input
                        value={script.label}
                        onChange={(e) => updateAdsterraScript(index, { label: e.target.value })}
                        placeholder="Social Bar"
                        className={fieldSm}
                      />
                    </label>
                    <label className="block text-xs text-ink-400">
                      Script URL
                      <input
                        value={script.src}
                        onChange={(e) => updateAdsterraScript(index, { src: e.target.value })}
                        placeholder="https://…/….js"
                        className={fieldSm}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="mt-6 text-sm font-semibold text-ink-100">Banners</h3>
            <div className="mt-3 space-y-3">
              {ADSTERRA_BANNER_SLOTS.map((slot) => {
                const unit = config.adsterra.banners[slot.id];
                return (
                  <div key={slot.id} className="rounded-md border border-ink-700 bg-ink-950 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink-100">{slot.label}</p>
                      <label className="flex items-center gap-2 text-sm text-ink-300">
                        <input
                          type="checkbox"
                          checked={unit.enabled}
                          onChange={(e) =>
                            updateAdsterraBanner(slot.id, { enabled: e.target.checked })
                          }
                        />
                        Show
                      </label>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="block text-xs text-ink-400 sm:col-span-2">
                        Key
                        <input
                          value={unit.key}
                          onChange={(e) =>
                            updateAdsterraBanner(slot.id, { key: e.target.value.trim() })
                          }
                          className={fieldSm}
                        />
                      </label>
                      <label className="block text-xs text-ink-400">
                        Width
                        <input
                          type="number"
                          value={unit.width}
                          onChange={(e) =>
                            updateAdsterraBanner(slot.id, {
                              width: Number(e.target.value) || unit.width,
                            })
                          }
                          className={fieldSm}
                        />
                      </label>
                      <label className="block text-xs text-ink-400">
                        Height
                        <input
                          type="number"
                          value={unit.height}
                          onChange={(e) =>
                            updateAdsterraBanner(slot.id, {
                              height: Number(e.target.value) || unit.height,
                            })
                          }
                          className={fieldSm}
                        />
                      </label>
                    </div>
                    <label className="mt-2 block text-xs text-ink-400">
                      Invoke host
                      <input
                        value={unit.invokeHost}
                        onChange={(e) =>
                          updateAdsterraBanner(slot.id, { invokeHost: e.target.value.trim() })
                        }
                        placeholder="www.highperformanceformat.com"
                        className={fieldSm}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {status && showSave ? (
          <p className="text-sm text-ink-400 sm:hidden">{status}</p>
        ) : null}
      </form>
    </AdminShell>
  );
}
