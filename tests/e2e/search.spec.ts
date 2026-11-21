import { expect, test } from "@playwright/test";
import { sql } from "./db";

// seed.sql: sv2a 201/165 리자몽 ex (영문 별칭 MEW 199/165), sv2a 205/165 뮤 ex
test("card number search goes straight to the card", async ({ page }) => {
  await page.goto("/search");
  await page.getByLabel("카드 번호 또는 이름").fill("SV2A 201/165");
  await page.getByLabel("카드 번호 또는 이름").press("Enter");
  await expect(page).toHaveURL(/\/cards\/sv2a\/201-165$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("sv2a 201/165");
  await expect(page.getByText("리자몽 ex", { exact: true }).first()).toBeVisible();
});

test("alias search explains it landed on the Korean card", async ({ page }) => {
  await sql`insert into card_aliases (card_id, lang, set_code, collector_number, name)
    select id, 'en', 'mew', '199/165', 'Charizard ex' from cards
    where set_code = 'sv2a' and collector_number = '201/165' on conflict do nothing`;
  await page.goto("/search?q=MEW 199/165");
  await expect(page).toHaveURL(/\/cards\/sv2a\/201-165\?from=en/);
  await expect(page.getByText("MEW 199/165(영문판)과 같은 그림의 한글판 카드예요")).toBeVisible();
});

test("canonical search shows no alias note", async ({ page }) => {
  await page.goto("/search?q=sv2a 201");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("sv2a 201/165");
  await expect(page.getByText("같은 그림의 한글판 카드예요")).toHaveCount(0);
});

test("name search lists candidates", async ({ page }) => {
  await page.goto("/search?q=리자몽");
  await expect(page.getByRole("heading", { name: /카드 \d+\+?장/ })).toBeVisible();
  await page.locator('a[href="/cards/sv2a/201-165"]').click();
  await expect(page).toHaveURL(/\/cards\/sv2a\/201-165$/);
});

test("unknown card shows the miss message", async ({ page }) => {
  await page.goto("/search?q=sv2a 999/165");
  await expect(page.getByRole("heading", { name: "‘sv2a 999/165’에 맞는 카드를 못 찾았어요" })).toBeVisible();
});

test("a missed number can be requested once", async ({ page }, info) => {
  const query = `sv2a 9${info.project.name === "mobile" ? 8 : 7}0/165`;
  await sql`delete from search_misses where query = ${query}`;
  await page.goto(`/search?q=${encodeURIComponent(query)}`);
  await page.getByRole("button", { name: "이 번호로 찾기 요청" }).click();
  await expect(page.getByText("요청이 기록됐어요")).toBeVisible();
  await expect(page.getByRole("button", { name: "이 번호로 찾기 요청" })).toHaveCount(0);
  // 지나가며 남는 검색 실패 1줄 + 요청 1줄. 같은 방문자가 다시 요청해도 늘지 않는다.
  const res = await page.request.post("/api/search-requests", { data: { query } });
  expect(res.status()).toBe(204);
  await expect
    .poll(async () => (await sql`select requested from search_misses where query = ${query} order by id`).map((r) => r.requested))
    .toEqual([false, true]);
});

test("unknown card URL shows the not-in-list page", async ({ page }) => {
  // 카드 조회가 스트리밍 안에서 일어나서 상태 코드는 200이다. Next가 noindex 메타를 붙인다.
  await page.goto("/cards/sv2a/999-165");
  await expect(page.getByRole("heading", { name: "이 카드는 아직 목록에 없어요" })).toBeVisible();
});

test("header search on a card page jumps to another card", async ({ page, isMobile }) => {
  await page.goto("/cards/sv2a/201-165");
  if (isMobile) await page.getByRole("button", { name: "메뉴 열기" }).click();
  const search = isMobile ? page.getByRole("search", { name: "머리글 카드 검색" }).filter({ visible: true }) : page.getByRole("banner").getByRole("search");
  await expect(search).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);

  await search.getByLabel("카드 번호 또는 이름 검색").fill("sv2a 205/165");
  await search.getByRole("button", { name: "찾기" }).click();
  await expect(page).toHaveURL(/\/cards\/sv2a\/205-165$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("sv2a 205/165");
});

test("home has no header search", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "카드 검색하기" })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("search")).toHaveCount(0);
});
