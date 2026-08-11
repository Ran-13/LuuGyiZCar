import { describe, expect, it } from "vitest";
import { calcEpornerXhrHash, isEpornerVideoId } from "@/lib/eporner-stream";

describe("eporner-stream", () => {
  it("calculates xhr hash like yt-dlp", () => {
    expect(calcEpornerXhrHash("b7418daa2ec5983df32b76da68cea596")).toBe(
      "1euhrxmcz6vjx1vgydwat2w1hy",
    );
  });

  it("validates video ids", () => {
    expect(isEpornerVideoId("ZLgWWTRBYcH")).toBe(true);
    expect(isEpornerVideoId("../etc")).toBe(false);
    expect(isEpornerVideoId("")).toBe(false);
  });
});
