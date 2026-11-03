import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { artistStats } from "@/lib/artist-stats";
import { db } from "@/lib/db";
import { artists, artworks, cards, engagements, requests, sets, users } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

// 작가 대시보드 통계: 내 도안이 받은 추천·다운로드 + 해결한 요청 수. 로컬 Docker PG(5432) 자가 시드.

const TAG = `as${Date.now()}`;
const SET_CODE = `${TAG}set`;

let cardId: string;
let artist: string;
let other: string;
let viewer1: string;
let viewer2: string;
let viewer3: string;
let myArtwork: string;
let otherArtwork: string;

beforeAll(async () => {
  await db.insert(sets).values({ code: SET_CODE, nameKo: `${TAG} 세트` });
  [{ id: cardId }] = await db
    .insert(cards)
    .values({ setCode: SET_CODE, collectorNumber: "010/165", nameKo: `${TAG} 이상해씨` })
    .returning({ id: cards.id });
  [{ id: artist }, { id: other }, { id: viewer1 }, { id: viewer2 }, { id: viewer3 }] = await db
    .insert(users)
    .values([
      { email: `${TAG}-artist@example.com` },
      { email: `${TAG}-other@example.com` },
      { email: `${TAG}-v1@example.com` },
      { email: `${TAG}-v2@example.com` },
      { email: `${TAG}-v3@example.com` },
    ])
    .returning({ id: users.id });
  // artworks.artist_id는 artists(user_id) FK → 작가 계정 행이 필요하다.
  // handle은 ^[a-z0-9_]{2,30}$ 제약. TAG( as+숫자)는 소문자·숫자라 그대로 쓰되 길이만 맞춘다.
  const h = TAG.toLowerCase().slice(0, 22);
  await db.insert(artists).values([
    { userId: artist, handle: `${h}_a`, displayName: `${TAG} 작가`, provider: "test" },
    { userId: other, handle: `${h}_o`, displayName: `${TAG} 남작가`, provider: "test" },
  ]);

  const arts = await db
    .insert(artworks)
    .values([
      { cardId, artistName: `${TAG}me`, format: "brg", status: "active", artistId: artist },
      { cardId, artistName: `${TAG}other`, format: "brg", status: "active", artistId: other },
    ])
    .returning({ id: artworks.id });
  [myArtwork, otherArtwork] = arts.map((r) => r.id);

  // 내 작품: recommend 2 (v1,v2), download 1 (v3). 남의 작품: recommend 1 (v1) — 집계에서 제외돼야.
  // (user,artwork)가 PK라 recommend와 download는 서로 다른 뷰어로 넣는다.
  await db.insert(engagements).values([
    { userId: viewer1, artworkId: myArtwork, kind: "recommend" },
    { userId: viewer2, artworkId: myArtwork, kind: "recommend" },
    { userId: viewer3, artworkId: myArtwork, kind: "download" },
    { userId: viewer1, artworkId: otherArtwork, kind: "recommend" },
  ]);
});

afterAll(async () => {
  await db.delete(engagements).where(inArray(engagements.artworkId, [myArtwork, otherArtwork]));
  await db.delete(requests).where(eq(requests.cardId, cardId));
  await db.delete(artworks).where(inArray(artworks.id, [myArtwork, otherArtwork]));
  await db.delete(cards).where(eq(cards.id, cardId));
  await db.delete(sets).where(eq(sets.code, SET_CODE));
  await db.delete(users).where(inArray(users.id, [artist, other, viewer1, viewer2, viewer3]));
});

describe("artistStats", () => {
  it("내 도안의 추천·다운로드만 집계 + 해결 요청 수", async () => {
    // 해결한 요청 1건 시드.
    await db
      .insert(requests)
      .values({ cardId, format: "brg", userId: artist, resolvedAt: new Date(), resolvedBy: artist });
    const stats = await artistStats(artist);
    expect(stats).toEqual({ recommends: 2, downloads: 1, resolved: 1 });
  });

  it("도안 없는 작가는 0", async () => {
    expect(await artistStats(other)).toMatchObject({ recommends: 1, downloads: 0 });
    // other는 작품이 1개(recommend 1) → recommends 1, downloads 0.
  });
});
