import { expect, test } from "@playwright/test";

test("카드 이미지가 hydration보다 먼저 로드돼도 표시된다", async ({ page }) => {
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => { releaseScripts = resolve; });
  await page.route("**/_next/static/**/*.js", async (route) => {
    await scriptsReady;
    await route.continue();
  });

  let missingImage: string | undefined;
  await page.route("**/api/card-images/**", (route) => {
    missingImage ??= route.request().url();
    if (route.request().url() === missingImage) return route.fulfill({ status: 404 });
    return route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="63" height="88"><rect width="63" height="88" fill="blue"/></svg>',
    });
  });

  const cards = page.locator('main a[href^="/cards/"]');
  try {
    await page.goto("/search", { waitUntil: "commit" });
    await expect.poll(() => cards.locator("img").evaluateAll((images) =>
      images.some((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0),
    )).toBe(true);
  } finally {
    releaseScripts();
  }

  await expect(cards.locator("img.opacity-100").first()).toHaveCSS("opacity", "1");
  await expect(cards.locator('div[aria-hidden="true"].bg-gradient-to-br').first()).toBeVisible();
});
