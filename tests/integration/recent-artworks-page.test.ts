import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";

// lib/artworks가 끌어오는 node 전용 모듈을 테스트 환경에서 막는다(다른 통합테스트와 동일).
vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  connection: async () => {},
}));

import { db } from "@/lib/db";
import { artists, artworks, cards, sets, users } from "@/lib/db/schema";
import { recentArtworksPage } from "@/lib/artworks";

// 전역(모든 카드)에서 최근 도안을 페이지네이션. 공유 dev DB에 기존 도안이 많으므로
// 정확 총계가 아니라 불변식(limit 준수 / 더 있으면 hasMore / offset 무중복)만 검증한다.
const TAG = `rap${Date.now()}`;
const SET_CODE = `${TAG}set`;
let cardId: string;
let userId: string;
let artIds: string[] = [];

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

  const rows = await db
    .insert(artworks)
    .values([
      { cardId, artistId: userId, artistName: `${TAG} 작가`, format: "9pocket", status: "active" },
      { cardId, artistId: userId, artistName: `${TAG} 작가`, format: "9pocket", status: "active" },
      { cardId, artistId: userId, artistName: `${TAG} 작가`, format: "9pocket", status: "active" },
    ])
    .returning({ id: artworks.id });
  artIds = rows.map((r) => r.id);
});

afterAll(async () => {
  await db.delete(artworks).where(inArray(artworks.id, artIds));
  await db.delete(artists).where(eq(artists.userId, userId));
  await db.delete(cards).where(eq(cards.id, cardId));
  await db.delete(sets).where(eq(sets.code, SET_CODE));
  await db.delete(users).where(eq(users.id, userId));
});

describe("recentArtworksPage (offset/limit/hasMore)", () => {
  it("limit을 지키고, 더 남았으면 hasMore=true", async () => {
    const page1 = await recentArtworksPage({ limit: 2, offset: 0 });
    expect(page1.artworks.length).toBe(2);
    expect(page1.hasMore).toBe(true); // 방금 넣은 3개 + 기존 도안들로 총 >2
  });

  it("offset으로 다음 페이지를 겹치지 않게 이어 받는다", async () => {
    const page1 = await recentArtworksPage({ limit: 2, offset: 0 });
    const page2 = await recentArtworksPage({ limit: 2, offset: 2 });
    const ids1 = page1.artworks.map((a) => a.id);
    const ids2 = page2.artworks.map((a) => a.id);
    expect(ids2.length).toBeGreaterThan(0);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  it("방금 올린 도안이 최신이라 첫 페이지에 뜬다", async () => {
    const page1 = await recentArtworksPage({ limit: 3, offset: 0 });
    expect(page1.artworks.some((a) => artIds.includes(a.id))).toBe(true);
  });
});
