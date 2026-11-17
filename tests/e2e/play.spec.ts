import { expect, test } from "@playwright/test";
import { ADMIN, ensureUser, sessionCookies } from "./db";

// 몬스터볼 수박게임(/play). 데스크탑에서, 순서대로.
// 로그인은 admin 크리덴셜 세션으로 흉내낸다(소셜 세션은 OAuth 콘솔이 없어 막혀 있음).
// admin 세션도 session.user.id를 담으므로 로그인 게이트를 통과한다.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "play runs on desktop");

test.beforeAll(async () => {
  await ensureUser(ADMIN, true);
});

test("signed-out visitor is redirected to login", async ({ page }) => {
  await page.goto("/play");
  await expect(page).toHaveURL(/\/artist\/login/);
});

test("logged-in user can load the game, see the leaderboard, and drop a ball", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies(await sessionCookies(ADMIN.email, ADMIN.password, baseURL!));
  await page.goto("/play");

  const canvas = page.getByTestId("game-canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByRole("heading", { name: /리더보드/ })).toBeVisible();

  // 캔버스를 클릭해 공을 떨어뜨려도 크래시 없이 계속 동작한다(스모크).
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3);
  }
  await page.waitForTimeout(600);
  await expect(canvas).toBeVisible();
});
