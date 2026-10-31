import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { FavoriteError, isFavorited, listFavoriteCards, toggleFavorite } from "@/lib/favorites";
import { MemberError, updateProfile } from "@/lib/members";
import { db } from "@/lib/supabase/server";
import { cardId, sql } from "../helpers/fixtures";

afterAll(() => sql.end());

let n = 0;
async function member(): Promise<string> {
  n += 1;
  const { data, error } = await db().auth.admin.createUser({
    email: `fav${n}-${Date.now()}@example.com`,
    email_confirm: true,
  });
  if (error) throw error;
  const uid = data.user.id;
  const ins = await db().from("members").insert({ user_id: uid, nickname: "수집가" });
  if (ins.error) throw ins.error;
  return uid;
}

async function cleanup() {
  const users = await sql<{ user_id: string }[]>`select user_id from members`;
  await sql`truncate favorites cascade`;
  for (const u of users) await db().auth.admin.deleteUser(u.user_id);
}

beforeEach(cleanup);

describe("card favorites", () => {
  it("toggles on and off and reports state", async () => {
    const uid = await member();
    const id = await cardId();

    expect(await isFavorited(uid, id)).toBe(false);
    expect(await toggleFavorite(uid, id)).toBe(true); // 추가
    expect(await isFavorited(uid, id)).toBe(true);
    expect(await toggleFavorite(uid, id)).toBe(false); // 해제
    expect(await isFavorited(uid, id)).toBe(false);
  });

  it("lists favorited cards with label, set name and artwork count", async () => {
    const uid = await member();
    const id = await cardId("sv2a", "201/165");
    await toggleFavorite(uid, id);

    const list = await listFavoriteCards(uid);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      cardId: id,
      label: "sv2a 201/165",
      path: "/cards/sv2a/201-165",
    });
    expect(typeof list[0].name).toBe("string");
    expect(list[0].setName.length).toBeGreaterThan(0);
    expect(list[0].artworkCount).toBeGreaterThanOrEqual(0);
  });

  it("rejects an unknown card", async () => {
    const uid = await member();
    await expect(toggleFavorite(uid, crypto.randomUUID())).rejects.toSatisfy(
      (e) => e instanceof FavoriteError && e.code === "not_found",
    );
    expect(await isFavorited(uid, "not-a-uuid")).toBe(false);
  });

  it("is private per member", async () => {
    const a = await member();
    const b = await member();
    const id = await cardId();
    await toggleFavorite(a, id);
    expect(await isFavorited(a, id)).toBe(true);
    expect(await isFavorited(b, id)).toBe(false);
    expect(await listFavoriteCards(b)).toHaveLength(0);
  });
});

describe("profile update", () => {
  it("changes the nickname", async () => {
    const uid = await member();
    await updateProfile(uid, { nickname: "  새 닉네임  " });
    const [row] = await sql<{ nickname: string }[]>`select nickname from members where user_id = ${uid}`;
    expect(row.nickname).toBe("새 닉네임");
  });

  it("rejects empty or too-long nicknames", async () => {
    const uid = await member();
    await expect(updateProfile(uid, { nickname: "   " })).rejects.toSatisfy(
      (e) => e instanceof MemberError && e.code === "nickname_required",
    );
    await expect(updateProfile(uid, { nickname: "x".repeat(41) })).rejects.toSatisfy(
      (e) => e instanceof MemberError && e.code === "nickname_too_long",
    );
  });
});
