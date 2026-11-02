import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyAdminAction } from "@/lib/admin";
import { ArtworkError, createArtwork, resolveDownload } from "@/lib/artworks";
import { cardId, PDF, PNG, resetArtworks, sql, storedPaths, uploadAsBrowser } from "../helpers/fixtures";

// @/auth는 node 전용 next-auth를 끌어와 테스트 환경에서 import가 깨진다(artists-auth.test.ts와 동일).
vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));

afterAll(() => sql.end());
beforeEach(resetArtworks);

const admin = { userId: "00000000-0000-0000-0000-000000000001", email: "admin@test" };

async function hosted() {
  const id = crypto.randomUUID();
  const original = await uploadAsBrowser("original", PDF, "application/pdf");
  const thumbnail = await uploadAsBrowser("thumbnail", PNG, "image/png");
  await createArtwork(
    {
      id, cardId: await cardId(), artistName: "확인", format: "brg",
      sourceUrl: "https://cafe.naver.com/x/1", sourceVisibility: "public",
      printSizeVerified: false,
    },
    { original, thumbnail },
    "test",
  );
  return id;
}

async function expectMismatch(p: Promise<unknown>) {
  await expect(p).rejects.toSatisfy((e) => e instanceof ArtworkError && e.code === "confirm_mismatch");
}

// blocked until sub D (storage): uploadAsBrowser/storedPaths/resolveDownload 전부 Supabase 스토리지에 의존.
// applyAdminAction의 비스토리지 로직(consent_events 등)은 admin-data-drizzle.test.ts가 커버한다.
describe("admin destructive actions need the card number on the server (eng E1)", () => {
  it("refuses to withdraw without a matching confirm and changes nothing", async () => {
    const id = await hosted();
    await expectMismatch(applyAdminAction(id, { action: "withdraw" }, admin));
    await expectMismatch(applyAdminAction(id, { action: "withdraw", confirm: "sv2a 205/165" }, admin));

    expect((await resolveDownload(id)).kind).toBe("ok");
    expect(await storedPaths()).toHaveLength(2);
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int from consent_events where artwork_id = ${id} and kind = 'status'`;
    expect(count).toBe(0);
  });

  it("withdraws when the confirm matches, ignoring case and spacing", async () => {
    const id = await hosted();
    await applyAdminAction(id, { action: "withdraw", confirm: " SV2A  201/165 ", reason: "요청" }, admin);
    expect(await storedPaths()).toEqual([]);
    const [row] = await sql`select actor, reason from consent_events where artwork_id = ${id} and kind = 'status'`;
    expect(row).toEqual({ actor: "admin@test", reason: "요청" });
  });

  it("hides and restores without confirm", async () => {
    const id = await hosted();
    await applyAdminAction(id, { action: "hide" }, admin);
    expect((await resolveDownload(id)).kind).toBe("unavailable");
    await applyAdminAction(id, { action: "restore" }, admin);
    expect((await resolveDownload(id)).kind).toBe("ok");
  });
});
