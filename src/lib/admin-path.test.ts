import { describe, expect, it } from "vitest";
import { normalizeAdminSlug } from "./admin-path";

describe("normalizeAdminSlug", () => {
  it("preserves mixed case", () => {
    expect(normalizeAdminSlug("Mhn6H0ZxtsxTvE")).toBe("Mhn6H0ZxtsxTvE");
  });

  it("strips slashes", () => {
    expect(normalizeAdminSlug("/panel/")).toBe("panel");
  });
});
