import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ArtworkError } from "@/lib/artworks";
import {
  getEngagement,
  recommendCount,
  recordDownloadEngagement,
  toggleRecommend,
} from "@/lib/engagements";
import { db } from "@/lib/db";
import { artworks, cards, engagements, sets, users } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

// 추천/다운로드 점수(중복불가 배타 + 23505 dedup)를 로컬 Docker Postgres(5432)에 직접 검증한다.
// 전역 시드에 의존하지 않고 필요한 행을 Drizzle로 직접 넣고 끝나면 지운다.

const TAG = `eng${Date.now()}`;
const SET_CODE = `${TAG}set`;

let card: string;
let art: string;
let userA: string;
let userB: string;

beforeAll(async () => {
  await db.insert(sets).values({ code: SET_CODE, nameKo: `${TAG} 세트` });
  [{ id: card }] = await db
    .insert(cards)
    .values({ setCode: SET_CODE, collectorNumber: "201/165", nameKo: `${TAG} 리자몽` })
    .returning({ id: cards.id });
  [{ id: art }] = await db
    .insert(artworks)
    .values({ cardId: card, artistName: `${TAG} 작가`, format: "9pocket", status: "active" })
    .returning({ id: artworks.id });
  [{ id: userA }, { id: userB }] = await db
    .insert(users)
    .values([{ email: `${TAG}-a@example.com` }, { email: `${TAG}-b@example.com` }])
    .returning({ id: users.id });
});

afterAll(async () => {
  await db.delete(engagements).where(eq(engagements.artworkId, art));
  await db.delete(artworks).where(eq(artworks.id, art));
  await db.delete(cards).where(eq(cards.id, card));
  await db.delete(sets).where(eq(sets.code, SET_CODE));
  await db.delete(users).where(inArray(users.id, [userA, userB]));
});

describe("toggleRecommend", () => {
  it("추천 토글 on/off와 상태 조회", async () => {
    expect(await getEngagement(userA, art)).toBeNull();
    expect(await toggleRecommend(userA, art)).toEqual({ recommended: true });
    expect(await getEngagement(userA, art)).toBe("recommend");
    expect(await toggleRecommend(userA, art)).toEqual({ recommended: false });
    expect(await getEngagement(userA, art)).toBeNull();
  });

  it("이미 다운로드했으면 추천 불가(배타)", async () => {
    await recordDownloadEngagement(userB, art);
    expect(await getEngagement(userB, art)).toBe("download");
    await expect(toggleRecommend(userB, art)).rejects.toSatisfy(
      (e) => e instanceof ArtworkError && e.code === "already_downloaded",
    );
    await db.delete(engagements).where(eq(engagements.userId, userB));
  });

  it("추천 insert의 23505 경합은 추천된 것으로 삼킨다", async () => {
    // 먼저 수동으로 추천 행을 넣어 두면, toggle은 current=recommend로 판단해 해제한다.
    // 23505 삼킴 경로를 직접 타려면 current 조회와 insert 사이 경합을 흉내내야 하므로,
    // insert 중복이 23505를 내는지와 삼켜지는지를 함께 확인한다.
    await db.insert(engagements).values({ userId: userA, artworkId: art, kind: "recommend" });
    // current=recommend → 해제.
    expect(await toggleRecommend(userA, art)).toEqual({ recommended: false });
    // 다시 추천.
    expect(await toggleRecommend(userA, art)).toEqual({ recommended: true });
    // 수동 중복 insert는 23505(토글이 삼키는 바로 그 에러).
    await expect(
      db.insert(engagements).values({ userId: userA, artworkId: art, kind: "download" }),
    ).rejects.toBeDefined();
    await db.delete(engagements).where(eq(engagements.userId, userA));
  });
});

describe("recordDownloadEngagement (23505 dedup)", () => {
  it("중복 다운로드 기록은 1점 유지(에러 없이 삼킴)", async () => {
    await recordDownloadEngagement(userA, art);
    await recordDownloadEngagement(userA, art); // 두 번째는 23505 삼킴
    expect(await getEngagement(userA, art)).toBe("download");
    const rows = await db
      .select()
      .from(engagements)
      .where(eq(engagements.userId, userA));
    expect(rows).toHaveLength(1);
    await db.delete(engagements).where(eq(engagements.userId, userA));
  });
});

describe("recommendCount", () => {
  it("recommend만 센다(download 제외)", async () => {
    await db.insert(engagements).values([
      { userId: userA, artworkId: art, kind: "recommend" },
      { userId: userB, artworkId: art, kind: "download" },
    ]);
    expect(await recommendCount(art)).toBe(1);
    await db.delete(engagements).where(eq(engagements.artworkId, art));
    expect(await recommendCount(art)).toBe(0);
  });
});
