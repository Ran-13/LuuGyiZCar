export function splitSiteName(siteName: string): { main: string; badge: string } {
  const parts = siteName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { main: parts[0] ?? "Site", badge: "" };
  }

  return {
    main: parts.slice(0, -1).join(" "),
    badge: parts.at(-1) ?? "",
  };
}
