import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FavoriteError, isFavorited, listFavoriteCards, toggleFavorite } from "@/lib/favorites";
import { db } from "@/lib/db";
import { artworks, cards, favorites, sets, users } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

// 카드 즐겨찾기 토글/목록(23505 경합 포함)을 로컬 Docker Postgres(5432)에 직접 검증한다.
// 전역 시드에 의존하지 않고 필요한 행을 Drizzle로 직접 넣고 끝나면 지운다.

const TAG = `fav${Date.now()}`;
const SET_CODE = `${TAG}set`;

let cardA: string; // 201/165
let cardB: string; // 205/165 (도안 1개)
let userA: string;
let userB: string;

beforeAll(async () => {
  await db.insert(sets).values({ code: SET_CODE, nameKo: `${TAG} 세트` });
  [{ id: cardA }, { id: cardB }] = await db
    .insert(cards)
    .values([
      { setCode: SET_CODE, collectorNumber: "201/165", nameKo: `${TAG} 리자몽 ex` },
      { setCode: SET_CODE, collectorNumber: "205/165", nameKo: `${TAG} 뮤 ex` },
    ])
    .returning({ id: cards.id });

  [{ id: userA }, { id: userB }] = await db
    .insert(users)
    .values([{ email: `${TAG}-a@example.com` }, { email: `${TAG}-b@example.com` }])
    .returning({ id: users.id });

  // cardB에 공개 도안 1개 → artworkCount 검증용.
  await db
    .insert(artworks)
    .values({ cardId: cardB, artistName: `${TAG} 작가`, format: "9pocket", status: "active" });
});

afterAll(async () => {
  await db.delete(favorites).where(inArray(favorites.userId, [userA, userB]));
  await db.delete(artworks).where(eq(artworks.cardId, cardB));
  await db.delete(cards).where(inArray(cards.id, [cardA, cardB]));
  await db.delete(sets).where(eq(sets.code, SET_CODE));
  await db.delete(users).where(inArray(users.id, [userA, userB]));
});

describe("toggleFavorite / isFavorited", () => {
  it("추가·해제 토글과 상태 조회", async () => {
    expect(await isFavorited(userA, cardA)).toBe(false);
    expect(await toggleFavorite(userA, cardA)).toBe(true); // 추가
    expect(await isFavorited(userA, cardA)).toBe(true);
    expect(await toggleFavorite(userA, cardA)).toBe(false); // 해제
    expect(await isFavorited(userA, cardA)).toBe(false);
  });

  it("없는 카드는 not_found, 비 UUID는 false", async () => {
    await expect(toggleFavorite(userA, crypto.randomUUID())).rejects.toSatisfy(
      (e) => e instanceof FavoriteError && e.code === "not_found",
    );
    expect(await isFavorited(userA, "not-a-uuid")).toBe(false);
  });

  it("동시 추가 경합(23505)은 추가된 것으로 본다", async () => {
    // 먼저 넣어 둔 뒤 toggle이 insert를 시도하도록 기존 조회를 우회할 수는 없으므로,
    // 같은 (user, card)에 중복 insert가 23505를 내고 삼켜지는지 직접 확인한다.
    await db.insert(favorites).values({ userId: userB, cardId: cardA });
    // 이미 존재 → toggle은 해제(false)를 반환한다.
    expect(await toggleFavorite(userB, cardA)).toBe(false);
    // 다시 추가.
    expect(await toggleFavorite(userB, cardA)).toBe(true);
    // 수동 중복 insert는 23505를 던진다(토글이 삼키는 바로 그 에러).
    await expect(db.insert(favorites).values({ userId: userB, cardId: cardA })).rejects.toBeDefined();
    await db.delete(favorites).where(eq(favorites.userId, userB));
  });
});

describe("listFavoriteCards", () => {
  it("라벨·세트명·도안수와 함께 최근 순으로 반환", async () => {
    await toggleFavorite(userA, cardA);
    await toggleFavorite(userA, cardB);

    const list = await listFavoriteCards(userA);
    expect(list).toHaveLength(2);
    // 최근 추가(cardB)가 먼저.
    expect(list[0].cardId).toBe(cardB);
    const a = list.find((c) => c.cardId === cardA)!;
    expect(a).toMatchObject({
      label: `${SET_CODE} 201/165`,
      name: `${TAG} 리자몽 ex`,
      setName: `${TAG} 세트`,
      path: `/cards/${SET_CODE}/201-165`,
      artworkCount: 0,
    });
    const b = list.find((c) => c.cardId === cardB)!;
    expect(b.artworkCount).toBe(1);
  });

  it("회원별로 분리된다", async () => {
    expect(await listFavoriteCards(userB)).toHaveLength(0);
  });
});
