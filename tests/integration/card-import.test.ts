import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { parseCardImport } from "@/lib/card-import";
import { db } from "@/lib/db";
import { cardAliases, cards, sets } from "@/lib/db/schema";
import { eq, like, sql } from "drizzle-orm";

// cards_import / search_cards_by_number는 Postgres 함수로 남아 있고(아직 Drizzle로 안 옮김),
// 로컬 Docker Postgres(5432)에 직접 호출해 검증한다. 전역 시드에 의존하지 않고 필요한 행만
// Drizzle로 넣고 끝나면 지운다. 테스트 전용 세트는 zz*, 별칭 충돌 확인용 "외부" 카드는 ex*.
const OUTSIDE_SET = `exset${Date.now()}`;
const OUTSIDE_NUMBER = "201/165";
const OUTSIDE_ALIAS_SET = `exmew${Date.now()}`;
const OUTSIDE_ALIAS_NUMBER = "199/165";
let outsideCardId: string;

async function clearTestSets() {
  await db.delete(cards).where(like(cards.setCode, "zz%"));
  await db.delete(sets).where(like(sets.code, "zz%"));
}

beforeAll(async () => {
  await db.insert(sets).values({ code: OUTSIDE_SET, nameKo: "외부 세트" });
  [{ id: outsideCardId }] = await db
    .insert(cards)
    .values({ setCode: OUTSIDE_SET, collectorNumber: OUTSIDE_NUMBER, nameKo: "외부 카드" })
    .returning({ id: cards.id });
  await db.insert(cardAliases).values({
    cardId: outsideCardId,
    lang: "en",
    setCode: OUTSIDE_ALIAS_SET,
    collectorNumber: OUTSIDE_ALIAS_NUMBER,
    name: "Outside",
  });
});

beforeEach(clearTestSets);

afterAll(async () => {
  await clearTestSets();
  await db.delete(cardAliases).where(eq(cardAliases.cardId, outsideCardId));
  await db.delete(cards).where(eq(cards.id, outsideCardId));
  await db.delete(sets).where(eq(sets.code, OUTSIDE_SET));
});

type ImportResult = {
  ok: boolean;
  inserted?: number;
  updated?: number;
  aliases?: number;
  errors?: { line: number; message: string }[];
};

async function run(csv: string, dryRun = false): Promise<ImportResult> {
  const parsed = parseCardImport(csv);
  expect(parsed.errors).toEqual([]);
  const res = await db.execute(
    sql`select public.cards_import(${JSON.stringify(parsed.sets)}::jsonb, ${JSON.stringify(parsed.cards)}::jsonb, ${dryRun}) as data`,
  );
  return (res.rows[0] as { data: ImportResult }).data;
}

const CSV = [
  "set_code,collector_number,name_ko,rarity,alias_set_code_en,alias_number_en,name_en,set_name_ko",
  "zz1,1/2,가,SAR,ZZE,10/20,Ga,테스트 세트",
  "zz1,2/2,나,AR,,,,테스트 세트",
].join("\n");

async function cardRows(setCode: string) {
  const res = await db.execute(
    sql`select collector_number, name_ko, rarity from cards where set_code = ${setCode} order by 1`,
  );
  return res.rows as { collector_number: string; name_ko: string; rarity: string | null }[];
}

describe("cards_import", () => {
  it("dry run counts without writing, apply writes, and re-running is idempotent", async () => {
    expect(await run(CSV, true)).toMatchObject({ ok: true, inserted: 2, updated: 0, aliases: 1 });
    expect((await cardRows("zz1")).length).toBe(0);

    expect(await run(CSV)).toMatchObject({ ok: true, inserted: 2, updated: 0 });
    expect(await run(CSV)).toMatchObject({ ok: true, inserted: 0, updated: 2 });
    expect(await cardRows("zz1")).toEqual([
      { collector_number: "1/2", name_ko: "가", rarity: "SAR" },
      { collector_number: "2/2", name_ko: "나", rarity: "AR" },
    ]);
    const [set] = await db.select({ nameKo: sets.nameKo }).from(sets).where(eq(sets.code, "zz1"));
    expect(set.nameKo).toBe("테스트 세트");
  });

  it("replaces a card's aliases with the file's, and lets an alias move between imported cards", async () => {
    await run(CSV);
    await run(
      [
        "set_code,collector_number,name_ko,alias_set_code_en,alias_number_en,name_en",
        "zz1,1/2,가,,,",
        "zz1,2/2,나,ZZE,10/20,Ga moved",
      ].join("\n"),
    );
    const res = await db.execute(sql`
      select c.collector_number, a.name from card_aliases a join cards c on c.id = a.card_id
      where c.set_code = 'zz1'`);
    expect(res.rows).toEqual([{ collector_number: "2/2", name: "Ga moved" }]);
  });

  it("writes nothing when a set is unknown or an alias belongs to a card outside the file", async () => {
    const result = await run(
      [
        "set_code,collector_number,name_ko,alias_set_code_en,alias_number_en,set_name_ko",
        "zz1,1/2,가,,,테스트 세트",
        "zz2,1/2,세트 없음,,,",
        `zz1,2/2,도용,${OUTSIDE_ALIAS_SET},${OUTSIDE_ALIAS_NUMBER},테스트 세트`,
      ].join("\n"),
    );
    expect(result.ok).toBe(false);
    expect(result.errors!.map((e) => e.line)).toEqual([3, 4]);
    expect(result.errors![1].message).toContain(`${OUTSIDE_SET} ${OUTSIDE_NUMBER}`);
    expect((await cardRows("zz1")).length).toBe(0);
    expect((await cardRows("zz2")).length).toBe(0);
  });

  it("imported cards are found by search through their alias", async () => {
    await run(CSV);
    const res = await db.execute(sql`select * from public.search_cards_by_number('zze', '10', null)`);
    expect(res.rows).toEqual([expect.objectContaining({ collector_number: "1/2" })]);
  });
});
