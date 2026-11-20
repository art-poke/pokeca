import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { clearArtworks, seedArtwork, sql } from "./db";

// 카드 상세 작품 목록 (design 4A·5A·6A·7A·14A, eng E3·E4·E5·E8).
test.describe.configure({ mode: "serial" });
test.beforeEach(clearArtworks);

const CARD = "/cards/sv2a/201-165";
const EMPTY_CARD = "/cards/sv2a/205-165";

async function artists(page: Page) {
  return page.getByRole("list", { name: "도안" }).locator("strong").allTextContents();
}

test("every artwork is a preview tile, newest first, with a download (design 4A)", async ({ page }) => {
  await seedArtwork({ artist: "먼저" });
  await seedArtwork({ artist: "회원글", visibility: "members_only" });
  await seedArtwork({ artist: "글삭제", linkStatus: "deleted" });
  await seedArtwork({ artist: "파일만", sourceUrl: null });

  await page.goto(CARD);
  await expect(page.getByRole("heading", { name: "확장 아트 도안 4개" })).toBeVisible();
  expect(await artists(page)).toEqual(["@파일만", "@글삭제", "@회원글", "@먼저"]);
  await expect(page.getByRole("img", { name: /확장 아트 도안$/ })).toHaveCount(4);
  await expect(page.getByRole("button", { name: /도안 다운로드$/ })).toHaveCount(4);
  await expect(page.getByRole("link", { name: /원본 글/ })).toHaveCount(0);

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

test("a tile opens the large view with download and the artist's source link", async ({ page }) => {
  await seedArtwork({ artist: "크게", format: "psa", visibility: "members_only" });
  await page.goto(CARD);
  await page.getByRole("button", { name: "@크게의 PSA 도안 크게 보기" }).click();

  const viewer = page.getByRole("dialog", { name: "@크게 · PSA" });
  await expect(viewer.getByRole("img", { name: "@크게의 PSA 확장 아트 도안" })).toBeVisible();
  await expect(viewer.getByText("PSA 보관 케이스 안쪽 80×135 mm")).toBeVisible();
  await expect(viewer.getByRole("link", { name: /작가 원본 글 ↗ ?\(새 탭\)/ })).toHaveAttribute("target", "_blank");
  await expect(viewer.getByText("카페 가입 필요")).toBeVisible();

  const downloading = page.waitForEvent("download");
  await viewer.getByRole("button", { name: /다운로드/ }).click();
  expect((await downloading).suggestedFilename()).toContain("sv2a_201-165");

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
});

test("a file without a source post gets format-based print guidance", async ({ page }) => {
  await seedArtwork({ artist: "출처없음", sourceUrl: null });
  await page.goto(CARD);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /다운로드/ }).click();
  await downloading;
  await expect(page.getByText("9포켓 규격에 맞춰 인쇄하세요.")).toBeVisible();
});

test("download starts and shows print guidance with verified size (eng E8)", async ({ page }) => {
  await seedArtwork({ artist: "치수확인", printSizeVerified: true });
  await page.goto(CARD);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /다운로드/ }).click();
  expect((await downloading).suggestedFilename()).toContain("sv2a_201-165");
  await expect(page.getByText("‘실제 크기(100%)’로")).toBeVisible();
  await expect(page.getByText("9포켓 조각 8장, 각 63×88 mm로 확인됐어요")).toBeVisible();
});

for (const format of ["psa", "brg"] as const) {
  test(`a verified ${format} file shows the storage case's inner size`, async ({ page }) => {
    await seedArtwork({ artist: "슬랩확인", format, printSizeVerified: true });
    await page.goto(CARD);
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: /다운로드/ }).click();
    await downloading;
    await expect(page.getByText(`${format.toUpperCase()} 보관 케이스 안쪽 80×135 mm로 확인됐어요`)).toBeVisible();
  });
}

test("unverified files point to the artist's own print guide", async ({ page }) => {
  await seedArtwork({ artist: "미확인", format: "psa" });
  await page.goto(CARD);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /다운로드/ }).click();
  await downloading;
  await expect(page.getByText("작가의 원본 글에 있는 인쇄 안내를 함께 확인하세요")).toBeVisible();
  await expect(page.getByText(/mm로 확인됐어요/)).toHaveCount(0);
});

test("an artwork hidden after the page loaded says it is no longer offered", async ({ page }) => {
  const id = await seedArtwork({ artist: "곧숨김" });
  await page.goto(CARD);
  await sql`update artworks set status = 'hidden' where id = ${id}`;
  await page.getByRole("button", { name: /다운로드/ }).click();
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
  const loginPrompt = page.getByRole("listitem").filter({ hasText: "로그인하면 요청할 수 있어요" }).last();
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

test("report dialog from the ··· menu saves a report (design 14A)", async ({ page }) => {
  const id = await seedArtwork({ artist: "신고대상" });
  await page.goto(CARD);
  await page.getByRole("button", { name: "@신고대상 도안 더보기" }).click();
  await page.getByRole("button", { name: "신고·내림 요청" }).click();
  const dialog = page.getByRole("dialog", { name: "신고·내림 요청" });
  await dialog.getByLabel("도용 의심").check();
  await dialog.getByRole("button", { name: "보내기" }).click();
  await expect(dialog.getByText("신고가 접수됐어요. 확인 후 처리할게요.")).toBeVisible();

  const [row] = await sql`select artwork_id, reason, status from reports`;
  expect(row).toMatchObject({ artwork_id: id, reason: "suspected_theft", status: "open" });
});

test("footer takedown form takes a source URL without an artwork", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "권리자 내림 요청" }).click();
  await page.getByLabel("원본 글 또는 도안 주소").fill("https://cafe.naver.com/pokeca/999");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByText("신고가 접수됐어요")).toBeVisible();
  const [row] = await sql`select artwork_id, source_url from reports`;
  expect(row).toMatchObject({ artwork_id: null, source_url: "https://cafe.naver.com/pokeca/999" });
});

test("home lists cards with recently added artworks (design 3A)", async ({ page }) => {
  await seedArtwork();
  await page.goto("/");
  const recent = page.getByRole("region", { name: "최근 도안이 등록된 카드" });
  await recent.getByRole("link", { name: /sv2a 201\/165/ }).click();
  await expect(page).toHaveURL(/\/cards\/sv2a\/201-165$/);
});
