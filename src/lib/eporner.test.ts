import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clampPage,
  decodeMojibake,
  formatAdded,
  mergeUniqueById,
  parseKeywords,
  searchVideos,
  toIsoDate,
  toIsoDuration,
  type EpornerVideo,
} from "./eporner";

/**
 * "얼공" encoded the way the upstream API sends it: each UTF-8 byte re-read as a
 * Latin-1 codepoint. Built from explicit bytes because 0x96 is an invisible C1
 * control character that does not survive being pasted as a literal.
 */
const MOJIBAKE_EOLGONG = String.fromCharCode(0xec, 0x96, 0xbc, 0xea, 0xb3, 0xb5);

describe("decodeMojibake", () => {
  it("repairs UTF-8 bytes that arrived as Latin-1 codepoints", () => {
    expect(decodeMojibake(MOJIBAKE_EOLGONG)).toBe("얼공");
  });

  it("leaves plain ASCII untouched", () => {
    expect(decodeMojibake("Cracked The Maid & Co.")).toBe("Cracked The Maid & Co.");
  });

  it("leaves genuine Latin-1 text untouched when it is not valid UTF-8", () => {
    // "Café" as real characters must not be mangled into bytes.
    expect(decodeMojibake("Café")).toBe("Café");
  });

  it("bails out on strings containing codepoints above 0xFF", () => {
    // Already-correct Korean has codepoints > 0xFF and must pass straight through.
    expect(decodeMojibake("얼공 Korea")).toBe("얼공 Korea");
  });

  it("returns the input unchanged for an empty string", () => {
    expect(decodeMojibake("")).toBe("");
  });
});

describe("clampPage", () => {
  it("defaults to 1 for non-numeric input", () => {
    expect(clampPage("abc")).toBe(1);
    expect(clampPage(undefined)).toBe(1);
    expect(clampPage(null)).toBe(1);
  });

  it("floors at 1", () => {
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-5)).toBe(1);
  });

  it("caps at 1000", () => {
    expect(clampPage(99_999)).toBe(1000);
    expect(clampPage(1000)).toBe(1000);
  });

  it("passes through valid pages, including numeric strings", () => {
    expect(clampPage("8")).toBe(8);
    expect(clampPage(42)).toBe(42);
  });
});

describe("parseKeywords", () => {
  it("splits, lowercases and de-duplicates", () => {
    expect(parseKeywords("Anal, anal, Blonde")).toEqual(["anal", "blonde"]);
  });

  it("drops title-length noise", () => {
    // The upstream keywords blob repeats the full title; it must not become a tag.
    const keywords = "amateur, this is a very long title that is really the video name, solo";
    expect(parseKeywords(keywords)).toEqual(["amateur", "solo"]);
  });

  it("respects the limit", () => {
    expect(parseKeywords("a, b, c, d, e", 3)).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array for an empty blob", () => {
    expect(parseKeywords("")).toEqual([]);
  });
});

describe("toIsoDuration", () => {
  it("formats minutes and seconds", () => {
    expect(toIsoDuration(658)).toBe("PT10M58S");
  });

  it("includes hours when present", () => {
    expect(toIsoDuration(7448)).toBe("PT2H4M8S");
  });

  it("omits zero components", () => {
    expect(toIsoDuration(600)).toBe("PT10M");
    expect(toIsoDuration(45)).toBe("PT45S");
  });

  it("returns empty string for non-positive or invalid input", () => {
    expect(toIsoDuration(0)).toBe("");
    expect(toIsoDuration(Number.NaN)).toBe("");
  });
});

describe("toIsoDate", () => {
  it("parses the upstream space-separated format", () => {
    // Upstream sends "2026-07-23 13:12:12", which is not valid ISO.
    expect(toIsoDate("2026-07-23 13:12:12")).toBe("2026-07-23T13:12:12.000Z");
  });

  it("returns empty string for unparseable input", () => {
    expect(toIsoDate("not a date")).toBe("");
  });
});

describe("formatAdded", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("describes recent dates in relative terms", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T00:00:00Z"));

    expect(formatAdded("2026-07-24 12:00:00")).toBe("today");
    expect(formatAdded("2026-07-23 12:00:00")).toBe("yesterday");
    expect(formatAdded("2026-07-15 00:00:00")).toBe("10 days ago");
    expect(formatAdded("2026-01-01 00:00:00")).toBe("6 months ago");
    expect(formatAdded("2024-01-01 00:00:00")).toBe("2 years ago");
  });

  it("returns empty string for unparseable input", () => {
    expect(formatAdded("garbage")).toBe("");
  });
});

const video = (id: string): EpornerVideo =>
  ({
    id,
    title: `Video ${id}`,
    keywords: "",
    views: 0,
    rate: "0.00",
    url: "",
    added: "2026-01-01 00:00:00",
    length_sec: 60,
    length_min: "1:00",
    embed: "",
    default_thumb: { size: "big", width: 640, height: 360, src: "" },
    thumbs: [],
  }) satisfies EpornerVideo;

describe("mergeUniqueById", () => {
  it("appends only ids not already present", () => {
    const merged = mergeUniqueById([video("a"), video("b")], [video("b"), video("c")]);
    expect(merged.map((v) => v.id)).toEqual(["a", "b", "c"]);
  });

  it("preserves existing order", () => {
    const merged = mergeUniqueById([video("x")], [video("y"), video("z")]);
    expect(merged.map((v) => v.id)).toEqual(["x", "y", "z"]);
  });

  it("drops excludeId from incoming", () => {
    const merged = mergeUniqueById([video("a")], [video("b"), video("skip")], "skip");
    expect(merged.map((v) => v.id)).toEqual(["a", "b"]);
  });

  it("de-duplicates within a single incoming batch", () => {
    const merged = mergeUniqueById([], [video("a"), video("a")]);
    expect(merged.map((v) => v.id)).toEqual(["a"]);
  });
});

describe("searchVideos", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const respondWith = (body: unknown, ok = true) =>
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body }),
    );

  it("coerces total_count when it arrives as a string", async () => {
    // The API returns a number for some queries and a string for others.
    respondWith({ videos: [], total_count: "5202" });
    const result = await searchVideos({ query: "korea", perPage: 24 });

    expect(result.totalCount).toBe(5202);
    expect(result.totalPages).toBe(Math.ceil(5202 / 24));
    expect(result.failed).toBe(false);
  });

  it("handles total_count as a number", async () => {
    respondWith({ videos: [], total_count: 100 });
    const result = await searchVideos({ query: "korea", perPage: 10 });

    expect(result.totalCount).toBe(100);
    expect(result.totalPages).toBe(10);
  });

  it("caps totalCount at the 100k the API will actually serve", async () => {
    respondWith({ videos: [], total_count: 4_389_662 });
    const result = await searchVideos({ query: "all", perPage: 100 });

    expect(result.totalCount).toBe(100_000);
    expect(result.totalPages).toBe(1000);
  });

  it("decodes mojibake titles in the response", async () => {
    respondWith({ videos: [{ ...video("a"), title: MOJIBAKE_EOLGONG }], total_count: 1 });
    const result = await searchVideos({ query: "korea" });

    expect(result.videos[0].title).toBe("얼공");
  });

  it("flags failure instead of throwing on a non-OK response", async () => {
    respondWith({}, false);
    const result = await searchVideos({ query: "korea" });

    expect(result.failed).toBe(true);
    expect(result.videos).toEqual([]);
  });

  it("flags failure when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await searchVideos({ query: "korea" });

    expect(result.failed).toBe(true);
  });
});
