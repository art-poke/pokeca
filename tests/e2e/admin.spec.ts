import { expect, test, type Page } from "@playwright/test";
import { ADMIN, clearArtworks, ensureUser, NOT_ADMIN, previewPng, seedArtwork, sql } from "./db";

// 어드민 화면 (design 11A, eng E1·E6·E7). 데스크톱에서만, 순서대로 돈다.
test.skip(({ isMobile }) => isMobile, "admin runs on desktop");

test.beforeAll(async () => {
  await ensureUser(ADMIN, true);
  await ensureUser(NOT_ADMIN, false);
});
test.beforeEach(clearArtworks);

async function login(page: Page, user = ADMIN) {
  await page.goto("/admin/login");
  await page.getByLabel("이메일").fill(user.email);
  await page.getByLabel("비밀번호").fill(user.password);
  await page.getByRole("button", { name: "로그인" }).click();
  // 로그인 server action이 쿠키를 심고 이동할 때까지 기다린다.
  if (user === ADMIN) await expect(page).toHaveURL(/\/admin$/);
}

test("admin pages send signed-out and non-admin users to login", async ({ page }) => {
  await page.goto("/admin/artworks");
  await expect(page).toHaveURL(/\/admin\/login$/);

  await login(page, NOT_ADMIN);
  await expect(page.getByText("이 계정은 어드민 목록에 없어요")).toBeVisible();
});

test("register an artwork with uploaded files and open its detail", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "운영 대시보드" })).toBeVisible();
  await page.getByRole("link", { name: "작품", exact: true }).click();
  await expect(page.getByRole("heading", { name: "작품", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "작품 등록" }).click();

  await page.getByLabel("카드 번호 또는 이름").fill("sv2a 205/165");
  await page.getByRole("button", { name: "카드 찾기" }).click();
  await expect(page.getByRole("status").filter({ hasText: /선택:.*sv2a 205\/165/i })).toBeVisible();
  await page.getByLabel("작가 이름(닉네임)").fill("업로드작가");
  await page.getByLabel("PSA").check();
  const png = await previewPng();
  const file = (name: string) => ({ name, mimeType: "image/png", buffer: png });
  // 미리보기는 비워 둔다: 서버가 원본에서 만든다.
  await page.getByLabel("클릭·드래그로 올리기", { exact: true }).setInputFiles(file("original.png"));
  await page.getByLabel(/보관·미리보기·다운로드를 허락받았어요/).check();
  await page.getByLabel(/^허락 근거/).setInputFiles(file("dm.png"));
  await page.getByRole("button", { name: "등록" }).click();

  await expect(page.getByRole("heading", { name: "sv2a 205/165 · @업로드작가" })).toBeVisible();
  await expect(page.getByText("미리보기 · image/webp")).toBeVisible();
  await expect(page.getByRole("region", { name: "변경 이력" }).getByText("등록", { exact: true })).toBeVisible();
  // 허락 근거는 어드민 라우트가 짧은 서명 URL로 보낸다 (설계 R3).
  const evidence = page.getByRole("link", { name: /근거 보기/ });
  const res = await page.request.get((await evidence.getAttribute("href"))!, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  expect(res.headers().location).toContain(process.env.S3_BUCKET_EVIDENCE!);

  const [artwork] = await sql<{ id: string }[]>`select id from artworks where artist_name = '업로드작가'`;
  await page.goto(`/artworks/${artwork.id}`);
  const img = page.getByRole("img", { name: /@업로드작가/ });
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: /다운로드/ })).toBeVisible();
});

test("record a manual link check from the list (eng E6)", async ({ page }) => {
  const id = await seedArtwork({ artist: "점검대상", linkStatus: "unchecked" });
  await login(page);
  await page.goto("/admin/artworks?check=1");
  const row = page.getByRole("row", { name: /@점검대상/ });
  await expect(row.getByText("점검 필요")).toBeVisible();
  await row.getByLabel(/링크 상태/).selectOption("deleted");
  await row.getByRole("button", { name: "점검 완료" }).click();

  await expect(page.getByText("0개 · 점검 필요 0개")).toBeVisible();
  const [a] = await sql`select link_status, link_checked_at from artworks where id = ${id}`;
  expect(a.link_status).toBe("deleted");
  expect(a.link_checked_at).not.toBeNull();
});

test("withdraw needs the card number typed in the dialog (design 11A, eng E1)", async ({ page }) => {
  const id = await seedArtwork({ artist: "철회대상" });
  await login(page);
  await page.goto(`/admin/artworks/${id}`);
  await page.getByRole("button", { name: "철회…" }).click();
  const dialog = page.getByRole("dialog", { name: "작품 철회" });
  const run = dialog.getByRole("button", { name: "작품 철회 실행" });
  await expect(run).toBeDisabled();
  await dialog.getByLabel(/카드 번호/).fill("sv2a 205/165");
  await expect(run).toBeDisabled();
  await dialog.getByLabel(/카드 번호/).fill("SV2A 201/165");
  await run.click();

  await expect(page.getByText("철회한 작품이라 더 바꿀 수 없어요.")).toBeVisible();
  const files = await sql`select 1 from artwork_files where artwork_id = ${id}`;
  expect(files).toHaveLength(0);
});

test("hide and restore need no confirmation", async ({ page }) => {
  const id = await seedArtwork({ artist: "숨김대상" });
  await login(page);
  await page.goto(`/admin/artworks/${id}`);
  await page.getByRole("button", { name: "숨기기" }).click();
  await expect(page.getByRole("button", { name: "다시 공개" })).toBeVisible();
  await page.getByRole("button", { name: "다시 공개" }).click();
  await expect(page.getByRole("button", { name: "숨기기" })).toBeVisible();
  await expect(page.getByText("상태 숨김 → 공개")).toBeVisible();
});

test("link a URL-only report to its artwork and close it (eng E7)", async ({ page }) => {
  await seedArtwork({ artist: "신고연결", sourceUrl: "https://cafe.naver.com/pokeca/42" });
  await sql`insert into reports (source_url, reason) values ('https://cafe.naver.com/pokeca/42', 'rights_holder')`;
  await login(page);
  await page.goto("/admin/reports");
  const report = page.getByTestId("open-report");
  await report.getByRole("button", { name: "연결" }).click();
  await expect(report.getByRole("link", { name: /@신고연결/ })).toBeVisible();

  await report.getByLabel("처리 메모").fill("작가 확인 후 숨김");
  await report.getByRole("button", { name: "처리 완료" }).click();
  await expect(page.getByText("미처리 0건")).toBeVisible();
  await expect(page.getByText("작가 확인 후 숨김")).toBeVisible();
});
