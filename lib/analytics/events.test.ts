import { describe, expect, it } from "vitest";
import { clampDwell, isBot, isExcludedPath, normalizePath, parseTrackedEvent } from "./events";

describe("normalizePath", () => {
  it("keeps a leading-slash path and strips query/hash", () => {
    expect(normalizePath("/search?q=리자몽#top")).toBe("/search");
    expect(normalizePath("/cards/sv2a/201")).toBe("/cards/sv2a/201");
  });
  it("rejects non-paths and caps length at 200", () => {
    expect(normalizePath("https://evil.test/x")).toBeNull();
    expect(normalizePath("search")).toBeNull();
    expect(normalizePath(123)).toBeNull();
    expect(normalizePath("/" + "a".repeat(300))).toHaveLength(200);
  });
});

describe("isExcludedPath", () => {
  it("excludes admin and artist consoles, not public pages", () => {
    expect(isExcludedPath("/admin")).toBe(true);
    expect(isExcludedPath("/admin/insights")).toBe(true);
    expect(isExcludedPath("/artist")).toBe(true);
    expect(isExcludedPath("/artist/new")).toBe(true);
    expect(isExcludedPath("/search")).toBe(false);
    expect(isExcludedPath("/administrators")).toBe(false); // prefix-exact, not substring
  });
});

describe("isBot", () => {
  it("flags common crawlers, passes real browsers and empty UA", () => {
    expect(isBot("Googlebot/2.1")).toBe(true);
    expect(isBot("Mozilla/5.0 ... HeadlessChrome/120")).toBe(true);
    expect(isBot("Mozilla/5.0 (iPhone) Safari/604")).toBe(false);
    expect(isBot(null)).toBe(false);
  });
});

describe("clampDwell", () => {
  it("clamps to 0..1h integer and handles junk", () => {
    expect(clampDwell(-5)).toBe(0);
    expect(clampDwell(1234.7)).toBe(1235);
    expect(clampDwell(9_999_999)).toBe(3_600_000);
    expect(clampDwell("abc")).toBe(0);
    expect(clampDwell(undefined)).toBe(0);
  });
});

describe("parseTrackedEvent", () => {
  const ua = "Mozilla/5.0 (Macintosh) Safari/605";

  it("accepts page_view with normalized path and referrer", () => {
    const r = parseTrackedEvent({ type: "page_view", path: "/search?q=x", ref: "https://google.com" }, ua);
    expect(r).toEqual({ outcome: "ok", type: "page_view", payload: { path: "/search", ref: "https://google.com" } });
  });

  it("accepts page_leave with clamped dwell", () => {
    const r = parseTrackedEvent({ type: "page_leave", path: "/", dwell_ms: -1 }, ua);
    expect(r).toEqual({ outcome: "ok", type: "page_leave", payload: { path: "/", dwell_ms: 0 } });
  });

  it("accepts click with trimmed, capped label", () => {
    const r = parseTrackedEvent({ type: "click", path: "/", label: "  nav:검색  " }, ua);
    expect(r).toEqual({ outcome: "ok", type: "click", payload: { path: "/", label: "nav:검색" } });
  });

  it("rejects unknown type, missing/invalid path, empty click label", () => {
    expect(parseTrackedEvent({ type: "source_click", path: "/" }, ua).outcome).toBe("invalid");
    expect(parseTrackedEvent({ type: "page_view", path: "nope" }, ua).outcome).toBe("invalid");
    expect(parseTrackedEvent({ type: "click", path: "/", label: "   " }, ua).outcome).toBe("invalid");
    expect(parseTrackedEvent(null, ua).outcome).toBe("invalid");
  });

  it("skips (no insert) for admin/artist paths and bots", () => {
    expect(parseTrackedEvent({ type: "page_view", path: "/admin/insights" }, ua).outcome).toBe("skip");
    expect(parseTrackedEvent({ type: "page_view", path: "/artist" }, ua).outcome).toBe("skip");
    expect(parseTrackedEvent({ type: "page_view", path: "/" }, "Googlebot/2.1").outcome).toBe("skip");
  });
});
