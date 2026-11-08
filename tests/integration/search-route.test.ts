import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { cards, sets } from "@/lib/db/schema";
import { GET } from "@/app/api/search/route";
import type { CardSearchPage } from "@/domains/card-search/api/types";

const TAG = `srt${Date.now()}`;
const SET_CODE = `${TAG}set`;
let ids: string[] = [];

beforeAll(async () => {
  await db.insert(sets).values({ code: SET_CODE, nameKo: `${TAG} 세트` });
  const rows = await db
    .insert(cards)
    .values([
      { setCode: SET_CODE, collectorNumber: "401/165", nameKo: `${TAG}라우트 하나` },
      { setCode: SET_CODE, collectorNumber: "402/165", nameKo: `${TAG}라우트 둘` },
      { setCode: SET_CODE, collectorNumber: "403/165", nameKo: `${TAG}라우트 셋` },
    ])
    .returning({ id: cards.id });
  ids = rows.map((r) => r.id);
});

afterAll(async () => {
  await db.delete(cards).where(inArray(cards.id, ids));
  await db.delete(sets).where(eq(sets.code, SET_CODE));
});

const call = async (q: string, offset: number): Promise<CardSearchPage> => {
  const res = await GET(
    new Request(`http://t/api/search?q=${encodeURIComponent(q)}&offset=${offset}`),
  );
  return (await res.json()) as CardSearchPage;
};

describe("GET /api/search", () => {
  it("offset/limit 페이지를 JSON으로 돌려준다", async () => {
    const p1 = await call(`${TAG}라우트`, 0);
    expect(p1.hits.length).toBeGreaterThan(0);
    expect(typeof p1.hasMore).toBe("boolean");
  });

  it("q가 비면 빈 결과", async () => {
    const empty = await call("   ", 0);
    expect(empty.hits).toEqual([]);
    expect(empty.hasMore).toBe(false);
  });
});
