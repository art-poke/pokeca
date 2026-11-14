import { describe, expect, it } from "vitest";
import { APP_IMAGE_PRESETS, isOptimizable } from "./app-image-presets";

describe("app-image presets", () => {
  it("has a preset for every variant with sizes + fit", () => {
    for (const v of ["card", "avatar", "artwork", "photo"] as const) {
      expect(APP_IMAGE_PRESETS[v].sizes).toBeTruthy();
      expect(["cover", "contain"]).toContain(APP_IMAGE_PRESETS[v].fit);
    }
  });

  it("card is a trading-card ratio, artwork has no fixed ratio", () => {
    expect(APP_IMAGE_PRESETS.card.aspectRatio).toBe("63 / 88");
    expect(APP_IMAGE_PRESETS.artwork.aspectRatio).toBeUndefined();
  });

  it("isOptimizable is false until a CDN host is configured", () => {
    expect(isOptimizable("https://example.com/a.webp")).toBe(false);
    expect(isOptimizable("/api/card-images/sv6/sv6_109.webp")).toBe(false);
  });
});
