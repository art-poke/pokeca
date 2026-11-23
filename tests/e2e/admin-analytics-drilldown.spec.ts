import { expect, test } from "@playwright/test";
import { ADMIN, ensureUser, sessionCookies } from "./db";

test("a dashboard panel opens its scoped report and keeps filters on reload", async ({
  page,
  context,
  baseURL,
}) => {
  await ensureUser(ADMIN, true);
  await context.addCookies(
    await sessionCookies(ADMIN.email, ADMIN.password, baseURL!),
  );
  await page.goto("/admin?from=2026-09-01&to=2026-10-31&unit=month");
  await page.getByRole("link", { name: "회원 성장 상세 보기" }).click();
  await expect(page).toHaveURL(
    /\/admin\/insights\/growth\?from=2026-09-01&to=2026-10-31&unit=month$/,
  );
  await page.getByLabel("로그인 방식").selectOption("google");
  await page.getByRole("button", { name: "필터 적용" }).click();
  await expect(page).toHaveURL(/provider=google/);
  await page.reload();
  await expect(page.getByLabel("로그인 방식")).toHaveValue("google");
  await page
    .getByRole("main")
    .getByRole("link", { name: "대시보드", exact: true })
    .click();
  await expect(page).toHaveURL(
    /\/admin\?from=2026-09-01&to=2026-10-31&unit=month$/,
  );
});
