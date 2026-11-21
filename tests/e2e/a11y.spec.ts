import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// design 10A: 공개 화면은 axe 위반 0개여야 한다. 화면이 늘어날 때마다 경로를 추가한다.
const publicPages = ["/", "/search?q=ex", "/search?q=sv2a 999", "/cards/sv2a/201-165", "/cards/sv2a/999-165", "/admin/login", "/artist/login", "/stories", "/stories/melee-pokemon-scramble"];

for (const path of publicPages) {
  test(`${path} has no axe violations`, async ({ page }) => {
    await page.goto(path);
    // 서버 컴포넌트가 스트리밍으로 채워지기 전에 검사하지 않도록 제목이 나올 때까지 기다린다.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.evaluate(() => Promise.allSettled(document.getAnimations()
      .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
      .map((animation) => animation.finished)));
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test("card search input has a visible label", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByLabel("카드 번호 또는 이름")).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
});
