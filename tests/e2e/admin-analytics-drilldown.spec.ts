import { expect, test } from "@playwright/test";
import { ADMIN, ensureUser, sessionCookies, sql } from "./db";

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

test("historical page views remain visible and a search identifies only the signed-in account", async ({
  page,
  context,
  baseURL,
}) => {
  await ensureUser(ADMIN, true);
  await context.addCookies(
    await sessionCookies(ADMIN.email, ADMIN.password, baseURL!),
  );
  const user = crypto.randomUUID();
  const visitor = crypto.randomUUID();
  const query = "검색 검증 " + user.slice(0, 8);
  const dates = "from=2014-06-12&to=2014-06-14";
  try {
    await sql`insert into users(id,name,email) values(${user},'소셜 이름 검증',${user + "@example.com"})`;
    await sql`insert into artists(user_id,display_name,provider) values(${user},'사이트 닉네임','kakao')`;
    for (const member of [null, user]) {
      await sql`insert into events(type,visitor_id,member_id,payload,created_at) values
        ('page_view',${visitor},${member},${sql.json({ page: visitor })},'2014-06-12T16:00:00Z'),
        ('search',${visitor},${member},${sql.json({ query, hits: 2 })},'2014-06-12T16:01:00Z')`;
    }
    await page.goto("/admin/insights/traffic?" + dates + "&page=" + visitor);
    await expect(
      page.getByRole("row", { name: "2014-06-13 1 2", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("row", { name: "2014-06-12 — —", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".recharts-area-dots circle").first(),
    ).toBeVisible();
    await page.goto("/admin/insights/search?" + dates);
    await page.getByRole("link", { name: query, exact: true }).click();
    const detail = page.locator("#observed-people");
    await expect(
      detail.getByRole("row", {
        name: /사이트 닉네임.*소셜 이름 검증.*카카오.*1/,
      }),
    ).toBeVisible();
    await expect(
      detail.getByRole("row", { name: /회원 연결 없음.*1/ }),
    ).toBeVisible();
    await detail.getByRole("link", { name: "사이트 닉네임" }).click();
    await expect(
      page.getByRole("cell", { name: user + "@example.com" }),
    ).toBeVisible();
  } finally {
    await sql`delete from events where visitor_id=${visitor}`;
    await sql`delete from users where id=${user}`;
  }
});
