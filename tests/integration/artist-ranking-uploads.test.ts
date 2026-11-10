import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { artists, artworks, cards, engagements, sets, users } from "@/lib/db/schema";
import { artistRanking } from "@/lib/ranking";

// 작가 랭킹 점수 = engagement(다운로드+추천) + 올린 도안 수. 올리기만 해도 랭킹에 오른다.
const TAG = `aru${Date.now()}`;
const SET_CODE = `${TAG}set`;
let cardId: string;
let userId: string;
let art1: string;
let art2: string;

beforeAll(async () => {
  await db.insert(sets).values({ code: SET_CODE, nameKo: `${TAG} 세트` });
  [{ id: cardId }] = await db
    .insert(cards)
    .values({ setCode: SET_CODE, collectorNumber: "201/165", nameKo: `${TAG} 카드` })
    .returning({ id: cards.id });
  [{ id: userId }] = await db
    .insert(users)
    .values({ email: `${TAG}@example.com` })
    .returning({ id: users.id });
  await db.insert(artists).values({ userId, displayName: `${TAG} 작가`, provider: "google" });

  [{ id: art1 }, { id: art2 }] = await db
    .insert(artworks)
    .values([
      { cardId, artistId: userId, artistName: `${TAG} 작가`, format: "9pocket", status: "active" },
      { cardId, artistId: userId, artistName: `${TAG} 작가`, format: "9pocket", status: "active" },
    ])
    .returning({ id: artworks.id });
});

afterAll(async () => {
  await db.delete(engagements).where(eq(engagements.userId, userId));
  await db.delete(artworks).where(inArray(artworks.id, [art1, art2]));
  await db.delete(artists).where(eq(artists.userId, userId));
  await db.delete(cards).where(eq(cards.id, cardId));
  await db.delete(sets).where(eq(sets.code, SET_CODE));
  await db.delete(users).where(eq(users.id, userId));
});

describe("artistRanking — 업로드 점수 합산", () => {
  it("engagement이 없어도 올린 도안 수만큼 점수가 잡힌다", async () => {
    const entry = (await artistRanking("all", 500)).find((e) => e.userId === userId);
    expect(entry).toBeTruthy();
    expect(entry!.score).toBe(2); // 도안 2개 올림, engagement 0
  });

  it("engagement이 추가되면 업로드 점수에 합산된다", async () => {
    await db.insert(engagements).values({ userId, artworkId: art1, kind: "recommend" });
    const entry = (await artistRanking("all", 500)).find((e) => e.userId === userId);
    expect(entry!.score).toBe(3); // 업로드 2 + engagement 1
  });
});
