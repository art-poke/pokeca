import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";

// @/lib/artists가 top-level에서 끌어오는 node 전용 모듈(next-auth, next/server)은
// 테스트 환경에서 import가 깨진다 → artists-auth.test와 동일하게 모킹한다.
vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  connection: async () => {},
}));

import { db } from "@/lib/db";
import { artists, artworks, cards, engagements, sets, users } from "@/lib/db/schema";
import { withdrawMyAccount, type Artist } from "@/lib/artists";
import { artistRanking, artworkRanking } from "@/lib/ranking";
import { listPublicArtworks } from "@/lib/artworks";

// 로컬 Docker Postgres(5432)에 직접 행을 넣고 탈퇴 동작을 검증한다. 끝나면 지운다.
const TAG = `whd${Date.now()}`;
const SET_CODE = `${TAG}set`;

let cardId: string;
let userId: string;
let artActive: string;
let artHidden: string;

beforeAll(async () => {
  await db.insert(sets).values({ code: SET_CODE, nameKo: `${TAG} 세트` });
  [{ id: cardId }] = await db
    .insert(cards)
    .values({ setCode: SET_CODE, collectorNumber: "201/165", nameKo: `${TAG} 리자몽 ex` })
    .returning({ id: cards.id });

  [{ id: userId }] = await db
    .insert(users)
    .values({ email: `${TAG}@example.com` })
    .returning({ id: users.id });
  await db.insert(artists).values({ userId, displayName: `${TAG} 작가`, provider: "google" });

  [{ id: artActive }, { id: artHidden }] = await db
    .insert(artworks)
    .values([
      { cardId, artistId: userId, artistName: `${TAG} 작가`, format: "9pocket", status: "active" },
      { cardId, artistId: userId, artistName: `${TAG} 작가`, format: "9pocket", status: "hidden" },
    ])
    .returning({ id: artworks.id });

  // active 도안에 추천 1 → 탈퇴 전엔 작가/작품 랭킹에 잡혀야 한다.
  await db.insert(engagements).values({ userId, artworkId: artActive, kind: "recommend" });
});

afterAll(async () => {
  await db.delete(engagements).where(eq(engagements.userId, userId));
  await db.delete(artworks).where(inArray(artworks.id, [artActive, artHidden]));
  await db.delete(artists).where(eq(artists.userId, userId));
  await db.delete(cards).where(eq(cards.id, cardId));
  await db.delete(sets).where(eq(sets.code, SET_CODE));
  await db.delete(users).where(eq(users.id, userId));
});

describe("withdrawMyAccount — 작품 숨김", () => {
  it("탈퇴 전엔 작가/작품 랭킹·카드상세에 보인다", async () => {
    expect((await artistRanking("all", 100)).some((e) => e.userId === userId)).toBe(true);
    expect((await artworkRanking("all", 100)).some((e) => e.artworkId === artActive)).toBe(true);
    expect((await listPublicArtworks(cardId)).some((a) => a.id === artActive)).toBe(true);
  });

  it("탈퇴하면 그 작가의 active/hidden 작품이 전부 withdrawn이 된다", async () => {
    // withdrawMyAccount는 artist.userId / artist.avatarPath만 읽는다.
    await withdrawMyAccount({ userId, avatarPath: null } as Artist);

    const rows = await db
      .select({ status: artworks.status })
      .from(artworks)
      .where(inArray(artworks.id, [artActive, artHidden]));
    expect(rows.every((r) => r.status === "withdrawn")).toBe(true);
  });

  it("탈퇴 후엔 작가/작품 랭킹·카드상세에서 사라진다", async () => {
    expect((await artistRanking("all", 100)).some((e) => e.userId === userId)).toBe(false);
    expect((await artworkRanking("all", 100)).some((e) => e.artworkId === artActive)).toBe(false);
    expect((await listPublicArtworks(cardId)).length).toBe(0);
  });
});
