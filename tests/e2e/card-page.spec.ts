import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { clearArtworks, memberSessionCookie, seedArtwork, sql } from "./db";

// 카드 상세 작품 목록 (design 4A·5A·6A·7A·14A, eng E3·E4·E5·E8).
test.beforeEach(clearArtworks);

const CARD = "/cards/sv2a/201-165";
const EMPTY_CARD = "/cards/sv2a/205-165";

async function openArtwork(page: Page, artist: string) {
  const list = page.getByRole("list", { name: "도안", exact: true });
  await list.getByRole("link", { name: new RegExp(`@${artist}`) }).click();
  await expect(page).toHaveURL(/\/artworks\//);
}

async function signIn(page: Page, baseURL: string) {
  await page.context().addCookies([await memberSessionCookie(baseURL)]);
}

test("the card upload link opens the form with that card selected", async ({ page, baseURL }) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  await page.context().addCookies([await memberSessionCookie(baseURL!, `upload-${suffix}@example.com`)]);
  await page.goto(CARD);
  await page.getByRole("link", { name: "도안 올리기", exact: true }).click();
  await expect(page).toHaveURL(/\/artist\/new\?cardId=[0-9a-f-]+$/);
  const handleInput = page.getByPlaceholder("예: my_art");
  await expect(handleInput).toBeVisible();
  await handleInput.fill(`upload_${suffix}`);
  await page.getByRole("button", { name: "정하고 계속하기" }).click();
  await expect(page.getByText("sv2a 201/165", { exact: true })).toBeVisible();
});

test("artwork shares use the card, format and public artwork thumbnail", async ({ request }) => {
  const id = await seedArtwork({ artist: "공유작가", format: "psa" });
  const response = await request.get(`/artworks/${id}`, {
    headers: { "User-Agent": "facebookexternalhit/1.1" },
  });
  expect(response.ok()).toBeTruthy();
  const head = (await response.text()).split("</head>")[0];
  expect(head).toMatch(/<meta property="og:title" content="[^"]*sv2a 201\/165 PSA 확장 아트[^"]*공유작가/);
  expect(head).toContain(`/api/thumbnails/${id}`);
  expect(head).toContain('name="twitter:image"');
});

test("artwork tiles are ordered newest first", async ({ page }) => {
  await seedArtwork({ artist: "먼저" });
  await seedArtwork({ artist: "회원글", visibility: "members_only" });
  await seedArtwork({ artist: "글삭제", linkStatus: "deleted" });
  await seedArtwork({ artist: "파일만", sourceUrl: null });

  await page.goto(CARD);
  await expect(page.getByRole("heading", { name: "확장 아트 도안 4개" })).toBeVisible();
  const tiles = page.getByRole("list", { name: "도안", exact: true }).getByRole("listitem");
  await expect(tiles).toHaveCount(4);
  for (const [index, author] of ["파일만", "글삭제", "회원글", "먼저"].entries()) {
    await expect(tiles.nth(index)).toContainText(`@${author}`);
  }
  await expect(page.getByRole("link", { name: /원본 글/ })).toHaveCount(0);

  await page.evaluate(() => Promise.allSettled(document.getAnimations()
    .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
    .map((animation) => animation.finished)));
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

test("a tile opens the artwork with its source link and download", async ({ page, baseURL }) => {
  await signIn(page, baseURL!);
  await seedArtwork({ artist: "크게", format: "psa", visibility: "members_only" });
  await page.goto(CARD);
  await openArtwork(page, "크게");
  await expect(page.getByRole("img", { name: /@크게/ })).toBeVisible();
  await expect(page.getByText("PSA 보관 케이스 안쪽 80×135 mm")).toBeVisible();
  await expect(page.getByRole("link", { name: /작가 원본 글/ })).toHaveAttribute("target", "_blank");
  await expect(page.getByText(/카페 가입 필요/)).toBeVisible();

  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "다운로드", exact: true }).click();
  expect((await downloading).suggestedFilename()).toContain("sv2a_201-165");
  await page.evaluate(() => Promise.allSettled(document.getAnimations()
    .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
    .map((animation) => animation.finished)));
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

const printCases = [
  { format: "9pocket", sourceUrl: null, verified: false, guidance: "9포켓 슬리브 규격에 맞춰 인쇄하세요." },
  { format: "9pocket", verified: true, guidance: "9포켓 슬리브용 조각 8장, 각 68×92 mm로 확인됐어요" },
  { format: "psa", verified: true, guidance: "PSA 보관 케이스 안쪽 80×135 mm로 확인됐어요" },
  { format: "brg", verified: true, guidance: "BRG 보관 케이스 안쪽 80×135 mm로 확인됐어요" },
  { format: "psa", verified: false, guidance: "작가 원본 글의 인쇄 안내도 확인하세요." },
] as const;

for (const entry of printCases) {
  test(`print guidance · ${entry.guidance}`, async ({ page, baseURL }) => {
    await signIn(page, baseURL!);
    const id = await seedArtwork({
      format: entry.format,
      printSizeVerified: entry.verified,
      sourceUrl: "sourceUrl" in entry ? entry.sourceUrl : undefined,
    });
    await page.goto(`/artworks/${id}`);
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "다운로드", exact: true }).click();
    await downloading;
    await expect(page.getByText(entry.guidance, { exact: false })).toBeVisible();
  });
}

test("an artwork hidden after the page loaded says it is no longer offered", async ({ page, baseURL }) => {
  await signIn(page, baseURL!);
  const id = await seedArtwork({ artist: "곧숨김" });
  await page.goto(`/artworks/${id}`);
  const download = page.getByRole("button", { name: "다운로드", exact: true });
  await expect(download).toBeVisible();
  await sql`update artworks set status = 'hidden' where id = ${id}`;
  await download.click();
  await expect(page.getByText("이 도안은 더 이상 제공되지 않아요")).toBeVisible();
});

test("both card request buttons prompt for login and their APIs reject guests", async ({ page }) => {
  await seedArtwork({ artist: "구포켓", format: "9pocket" });
  await page.goto(CARD);
  await expect(page.getByText("도안 찾아 주세요")).toHaveCount(0);

  await page.getByRole("button", { name: "BRG 요청", exact: true }).click();
  await expect(page.getByText("로그인하면 요청할 수 있어요")).toBeVisible();

  const filter = page.getByRole("group", { name: "규격" }).getByRole("button", { name: /^BRG/ });
  await filter.click();
  await expect(filter).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "이 카드의 BRG 도안 찾아 주세요" })).toBeVisible();

  const [card] = await sql<{ id: string }[]>`select id from cards where set_code = 'sv2a' and collector_number = '201/165'`;
  for (const endpoint of ["request", "requests"]) {
    const response = await page.request.post(`/api/cards/${card.id}/${endpoint}`, { data: { format: "brg" } });
    expect(response.status()).toBe(401);
  }

  await page.getByRole("button", { name: "찾기 요청", exact: true }).click();
  const loginPrompt = page.getByRole("listitem").filter({ hasText: "로그인하면 요청할 수 있어요" });
  await loginPrompt.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/artist\/login/);

  const [{ count }] = await sql<{ count: number }[]>`select count(*)::int from requests where card_id = ${card.id}`;
  expect(count).toBe(0);
});

test("a card with no artworks asks which format, and shows waiting counts from 3 (eng E5)", async ({ page }) => {
  const [card] = await sql<{ id: string }[]>`select id from cards where set_code = 'sv2a' and collector_number = '205/165'`;
  for (let i = 0; i < 3; i++) {
    await sql`insert into requests (card_id, format, visitor_id) values (${card.id}, 'brg', ${crypto.randomUUID()})`;
  }
  await page.goto(EMPTY_CARD);
  await expect(page.getByText("어떤 규격이 필요하세요?")).toBeVisible();
  await expect(page.getByText("3명이 기다리는 중")).toBeVisible();

  await page.getByRole("button", { name: "PSA 찾기 요청" }).click();
  await expect(page.getByText("로그인하면 요청할 수 있어요")).toBeVisible();

  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int from requests where card_id = ${card.id} and format = 'psa'`;
  expect(count).toBe(0);
});

test("report dialog from the artwork saves a report", async ({ page }) => {
  const id = await seedArtwork({ artist: "신고대상" });
  await page.goto(`/artworks/${id}`);
  await page.getByRole("button", { name: "신고·내림 요청" }).click();
  const dialog = page.getByRole("dialog", { name: "신고·내림 요청" });
  await dialog.getByLabel("도용 의심").check();
  await dialog.getByRole("button", { name: "보내기" }).click();
  await expect(dialog.getByText("신고가 접수됐어요. 확인 후 처리할게요.")).toBeVisible();

  const [row] = await sql`select artwork_id, reason, status from reports`;
  expect(row).toMatchObject({ artwork_id: id, reason: "suspected_theft", status: "open" });
});

test("takedown API accepts a source URL without an artwork", async ({ request }) => {
  const sourceUrl = "https://cafe.naver.com/pokeca/999";
  const response = await request.post("/api/reports", { data: { sourceUrl, reason: "rights_holder" } });
  expect(response.ok()).toBe(true);
  const [row] = await sql`select artwork_id, source_url from reports`;
  expect(row).toMatchObject({ artwork_id: null, source_url: "https://cafe.naver.com/pokeca/999" });
});

test("home links to recently added artworks", async ({ page }) => {
  const id = await seedArtwork();
  await page.goto("/");
  const recent = page.getByRole("region", { name: "최근 올라온 도안" });
  await recent.getByRole("link", { name: /sv2a 201\/165/i }).click();
  await expect(page).toHaveURL(`/artworks/${id}`);
});
