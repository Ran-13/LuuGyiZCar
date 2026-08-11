/** Default public theme — matches globals.css ink palette. */
export const DEFAULT_BACKGROUND = "#0a0a0a";
export const DEFAULT_TEXT = "#e6e6e6";

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

/** Normalize #abc → #aabbcc; invalid → fallback. */
export function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  let s = value.trim();
  if (!s) return fallback;
  if (!s.startsWith("#")) s = `#${s}`;
  if (!isValidHexColor(s)) return fallback;
  if (s.length === 4) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return s.toLowerCase();
}

function parseRgb(hex: string): [number, number, number] {
  const h = normalizeHexColor(hex, DEFAULT_BACKGROUND).slice(1);
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseRgb(a);
  const [br, bg, bb] = parseRgb(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isDarkBackground(backgroundColor: string): boolean {
  return relativeLuminance(backgroundColor) < 0.45;
}

/**
 * Build CSS custom properties so Tailwind ink-* utilities follow admin colors.
 */
export function buildSiteThemeCssVars(
  backgroundColor: string,
  textColor: string,
): Record<string, string> {
  const bg = normalizeHexColor(backgroundColor, DEFAULT_BACKGROUND);
  const text = normalizeHexColor(textColor, DEFAULT_TEXT);
  const dark = isDarkBackground(bg);
  const surfaceToward = dark ? "#ffffff" : "#000000";

  return {
    "--color-ink-950": bg,
    "--color-ink-900": mix(bg, surfaceToward, dark ? 0.045 : 0.04),
    "--color-ink-850": mix(bg, surfaceToward, dark ? 0.07 : 0.06),
    "--color-ink-800": mix(bg, surfaceToward, dark ? 0.1 : 0.09),
    "--color-ink-700": mix(bg, surfaceToward, dark ? 0.16 : 0.14),
    "--color-ink-600": mix(bg, surfaceToward, dark ? 0.24 : 0.22),
    "--color-ink-400": mix(text, bg, 0.42),
    "--color-ink-300": mix(text, bg, 0.22),
    "--color-ink-100": text,
    "color-scheme": dark ? "dark" : "light",
  };
}

export function siteThemeStyle(
  backgroundColor: string,
  textColor: string,
): Record<string, string> {
  return buildSiteThemeCssVars(backgroundColor, textColor);
}
