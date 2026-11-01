import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recentArtworkCards, searchCards } from "@/lib/cards";
import { artworkRanking } from "@/lib/ranking";
import { db } from "@/lib/db";
import {
  artworks,
  cardAliases,
  cards,
  engagements,
  sets,
  users,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

// RPC 기반 검색(search_cards_by_name/by_number)과 랭킹 정렬을 로컬 Docker Postgres(5432)에
// 직접 검증한다. 전역 시드에 의존하지 않고 필요한 행을 Drizzle로 직접 넣고 끝나면 지운다.

const TAG = `cst${Date.now()}`;
const SET_CODE = `${TAG}set`; // 세트 코드(소문자, 검색은 대소문자 무시)

// 정본 카드 2장 + 리자몽의 영문 별칭 1건.
let charizardId: string; // 201/165 리자몽 ex
let mewId: string; // 205/165 뮤 ex
let userId: string;
let art1: string; // 추천 많은 도안
let art2: string; // 추천 적은 도안

beforeAll(async () => {
  await db.insert(sets).values({ code: SET_CODE, nameKo: `${TAG} 세트` });
  [{ id: charizardId }, { id: mewId }] = await db
    .insert(cards)
    .values([
      { setCode: SET_CODE, collectorNumber: "201/165", nameKo: `${TAG} 리자몽 ex` },
      { setCode: SET_CODE, collectorNumber: "205/165", nameKo: `${TAG} 뮤 ex` },
    ])
    .returning({ id: cards.id });

  await db.insert(cardAliases).values({
    cardId: charizardId,
    lang: "en",
    setCode: `${TAG}mew`,
    collectorNumber: "199/165",
    name: `${TAG} charizard`,
  });

  [{ id: userId }] = await db
    .insert(users)
    .values({ email: `${TAG}@example.com` })
    .returning({ id: users.id });

  [{ id: art1 }, { id: art2 }] = await db
    .insert(artworks)
    .values([
      { cardId: charizardId, artistName: `${TAG} 작가`, format: "9pocket", status: "active" },
      { cardId: mewId, artistName: `${TAG} 작가`, format: "9pocket", status: "active" },
    ])
    .returning({ id: artworks.id });

  // art1(리자몽)에 추천 2, art2(뮤)에 추천 0 — 단일 유저로 두 도안 각각 1행이지만
  // 랭킹 정렬 검증은 "추천 받은 도안이 안 받은 도안보다 위"로 충분하다.
  await db.insert(engagements).values({ userId, artworkId: art1, kind: "recommend" });
});

afterAll(async () => {
  await db.delete(engagements).where(eq(engagements.userId, userId));
  await db.delete(artworks).where(inArray(artworks.id, [art1, art2]));
  await db.delete(cardAliases).where(eq(cardAliases.cardId, charizardId));
  await db.delete(cards).where(inArray(cards.id, [charizardId, mewId]));
  await db.delete(sets).where(eq(sets.code, SET_CODE));
  await db.delete(users).where(eq(users.id, userId));
});

describe("searchCards (RPC search_cards_by_number)", () => {
  it("정본 세트·번호를 흔한 표기로 찾는다", async () => {
    for (const q of [`${SET_CODE} 201/165`, `${SET_CODE}-201`]) {
      const { hits } = await searchCards(q);
      const hit = hits.find((h) => h.cardId === charizardId);
      expect(hit, q).toBeTruthy();
      expect(hit!.collectorNumber).toBe("201/165");
      expect(hit!.alias).toBeNull();
    }
  });

  it("영문 별칭으로 검색하면 한글 정본 카드에 도달한다", async () => {
    const { hits } = await searchCards(`${TAG}mew 199/165`);
    const hit = hits.find((h) => h.cardId === charizardId);
    expect(hit).toBeTruthy();
    expect(hit!.collectorNumber).toBe("201/165");
    expect(hit!.alias).toEqual({
      lang: "en",
      setCode: `${TAG}mew`,
      collectorNumber: "199/165",
    });
  });

  it("없는 번호면 이 세트에서 아무것도 안 나온다", async () => {
    const { hits } = await searchCards(`${SET_CODE} 999/165`);
    expect(hits.some((h) => h.cardId === charizardId || h.cardId === mewId)).toBe(false);
  });
});

describe("searchCards (RPC search_cards_by_name)", () => {
  it("한글 이름과 별칭 이름으로 찾는다", async () => {
    const byKo = await searchCards(`${TAG} 리자몽`);
    expect(byKo.hits.some((h) => h.cardId === charizardId)).toBe(true);

    const byAlias = await searchCards(`${TAG} charizard`);
    expect(byAlias.hits.some((h) => h.cardId === charizardId)).toBe(true);
  });
});

describe("recentArtworkCards", () => {
  it("최근 active 도안이 등록된 카드를 돌려준다", async () => {
    const recent = await recentArtworkCards(100);
    const codes = recent.filter((r) => r.collectorNumber === "201/165").map((r) => r.nameKo);
    expect(codes).toContain(`${TAG} 리자몽 ex`);
  });
});

describe("artworkRanking (추천 집계 정렬)", () => {
  it("추천 받은 도안이 상위에 온다", async () => {
    const all = await artworkRanking("all", 100);
    const ranked = all.find((e) => e.artworkId === art1);
    expect(ranked).toBeTruthy();
    expect(ranked!.recommends).toBe(1);
    // 추천 0인 art2는 집계(engagements)에 없으므로 랭킹에 안 나온다.
    expect(all.some((e) => e.artworkId === art2)).toBe(false);
  });
});
