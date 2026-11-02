import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  listOpenRequests,
  requestArt,
  requestedFormats,
  resolveRequests,
  resolvedCountByArtist,
} from "@/lib/art-requests";
import { db } from "@/lib/db";
import { cards, requests, sets, users } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

// 규격별 도안 요청 → 요청방 집계 → 작가 업로드 시 해결 처리 → 작가 해결수.
// 로컬 Docker Postgres(5432)에 자가 시드 후 정리. 23505 중복 요청 삼킴도 검증.

const TAG = `ar${Date.now()}`;
const SET_CODE = `${TAG}set`;

let card: string;
let m1: string;
let m2: string;
let artist: string;

beforeAll(async () => {
  await db.insert(sets).values({ code: SET_CODE, nameKo: `${TAG} 세트` });
  [{ id: card }] = await db
    .insert(cards)
    .values({ setCode: SET_CODE, collectorNumber: "201/165", nameKo: `${TAG} 리자몽` })
    .returning({ id: cards.id });
  [{ id: m1 }, { id: m2 }, { id: artist }] = await db
    .insert(users)
    .values([
      { email: `${TAG}-m1@example.com` },
      { email: `${TAG}-m2@example.com` },
      { email: `${TAG}-artist@example.com` },
    ])
    .returning({ id: users.id });
});

afterAll(async () => {
  await db.delete(requests).where(eq(requests.cardId, card));
  await db.delete(cards).where(eq(cards.id, card));
  await db.delete(sets).where(eq(sets.code, SET_CODE));
  await db.delete(users).where(inArray(users.id, [m1, m2, artist]));
});

describe("requestArt / requestedFormats (23505 dedup)", () => {
  it("요청 생성·조회, 같은 카드×규격 재요청은 무시", async () => {
    await requestArt(m1, card, "9pocket");
    await requestArt(m1, card, "9pocket"); // 23505 → 무시
    await requestArt(m1, card, "psa");
    expect((await requestedFormats(m1, card)).sort()).toEqual(["9pocket", "psa"]);
    // 회원별 분리.
    expect(await requestedFormats(m2, card)).toEqual([]);

    const rows = await db.select().from(requests).where(eq(requests.userId, m1));
    expect(rows).toHaveLength(2);
  });

  it("비UUID/잘못된 규격은 Error", async () => {
    await expect(requestArt(m1, "not-a-uuid", "9pocket")).rejects.toThrow("not_found");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(requestArt(m1, card, "bogus" as any)).rejects.toThrow("invalid_format");
    expect(await requestedFormats(m1, "not-a-uuid")).toEqual([]);
  });
});

describe("listOpenRequests", () => {
  it("(카드×규격)별 미해결 요청수 집계, 내림차순", async () => {
    await requestArt(m2, card, "9pocket"); // 9pocket: m1,m2 → 2
    const list = await listOpenRequests();
    const mine = list.filter((i) => i.cardLabel === `${SET_CODE} 201/165`);
    const nine = mine.find((i) => i.format === "9pocket")!;
    const psa = mine.find((i) => i.format === "psa")!;
    expect(nine.count).toBe(2);
    expect(psa.count).toBe(1);
    expect(nine).toMatchObject({
      name: `${TAG} 리자몽`,
      formatLabel: "9포켓",
      cardPath: `/cards/${SET_CODE}/201-165`,
    });
    // 집계 내 9pocket이 psa보다 앞(내림차순).
    expect(mine.findIndex((i) => i.format === "9pocket")).toBeLessThan(
      mine.findIndex((i) => i.format === "psa"),
    );
  });
});

describe("resolveRequests / resolvedCountByArtist", () => {
  it("작가 업로드 시 해당 규격 미해결 요청 해결, 해결수 집계", async () => {
    // 9pocket 요청(m1,m2) 2건을 artist가 해결.
    await resolveRequests(card, "9pocket", artist);
    // 해결되면 미해결 목록·내 미해결 규격에서 빠진다.
    expect(await requestedFormats(m1, card)).toEqual(["psa"]);
    const list = await listOpenRequests();
    const nine = list.find(
      (i) => i.cardLabel === `${SET_CODE} 201/165` && i.format === "9pocket",
    );
    expect(nine).toBeUndefined();
    // artist가 해결한 요청 수 = 2.
    expect(await resolvedCountByArtist(artist)).toBe(2);
    // 비UUID는 0.
    expect(await resolvedCountByArtist("not-a-uuid")).toBe(0);
  });
});
