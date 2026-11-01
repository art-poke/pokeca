import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cards, events, searchMisses, sets } from "@/lib/db/schema";
import { parseQuery, type ParsedQuery } from "@/lib/search";

// 공개 응답 DTO (eng D6). DB 행을 그대로 내보내지 않는다.
export type CardHit = {
  cardId: string;
  setCode: string;
  collectorNumber: string;
  nameKo: string;
  rarity: string | null;
  setName: string;
  artworkCount: number;
  alias: { lang: "ja" | "en"; setCode: string; collectorNumber: string } | null;
};

type CardHitRow = {
  card_id: string;
  set_code: string;
  collector_number: string;
  name_ko: string;
  rarity: string | null;
  set_name: string;
  artwork_count: number;
  alias_lang: "ja" | "en" | null;
  alias_set_code: string | null;
  alias_number: string | null;
};

function toHit(r: CardHitRow): CardHit {
  return {
    cardId: r.card_id,
    setCode: r.set_code,
    collectorNumber: r.collector_number,
    nameKo: r.name_ko,
    rarity: r.rarity,
    setName: r.set_name,
    artworkCount: r.artwork_count,
    alias: r.alias_lang
      ? { lang: r.alias_lang, setCode: r.alias_set_code!, collectorNumber: r.alias_number! }
      : null,
  };
}

export type SearchResult = { parsed: ParsedQuery; hits: CardHit[] };

export async function searchCards(query: string): Promise<SearchResult> {
  const parsed = parseQuery(query);
  if (parsed.kind === "empty") return { parsed, hits: [] };

  // plpgsql 검색 함수를 그대로 호출한다(TS 재구현 금지). 반환은 card_hit 합성 타입.
  const result =
    parsed.kind === "name"
      ? await db.execute(sql`select * from public.search_cards_by_name(${parsed.text})`)
      : await db.execute(
          sql`select * from public.search_cards_by_number(${parsed.kind === "set_number" ? parsed.set : null}, ${parsed.number}, ${parsed.total})`,
        );
  return { parsed, hits: (result.rows as CardHitRow[]).map(toHit) };
}

// 측정 기록은 실패해도 화면을 막지 않는다. 호출자는 after() 안에서 부른다.
// 등록 폼(어드민·작가)의 카드 후보.
export async function cardCandidates(query: string) {
  const { hits } = await searchCards(query.slice(0, 100));
  return hits.map((h) => ({
    cardId: h.cardId,
    label: `${h.setCode} ${h.collectorNumber}`,
    name: h.nameKo,
    setName: h.setName,
  }));
}

export async function recordSearch(
  query: string,
  result: SearchResult,
  visitorId: string | null,
): Promise<void> {
  await db.insert(events).values({
    type: "search",
    visitorId,
    cardId: result.hits.length === 1 ? result.hits[0].cardId : null,
    payload: { query, kind: result.parsed.kind, hits: result.hits.length },
  });
  if (result.hits.length === 0 && result.parsed.kind !== "empty") {
    await db.insert(searchMisses).values({ query, parsed: result.parsed, visitorId });
  }
}

export type CardDetail = {
  cardId: string;
  setCode: string;
  collectorNumber: string;
  nameKo: string;
  rarity: string | null;
  illustrator: string | null;
  setName: string;
};

export async function getCard(setCode: string, collectorNumber: string): Promise<CardDetail | null> {
  const rows = await db
    .select({
      id: cards.id,
      setCode: cards.setCode,
      collectorNumber: cards.collectorNumber,
      nameKo: cards.nameKo,
      rarity: cards.rarity,
      illustrator: cards.illustrator,
      setName: sets.nameKo,
    })
    .from(cards)
    .innerJoin(sets, eq(cards.setCode, sets.code))
    .where(and(eq(cards.setCode, setCode), eq(cards.collectorNumber, collectorNumber)))
    .limit(1);
  const data = rows[0] ?? null;
  if (!data) return null;
  return {
    cardId: data.id,
    setCode: data.setCode,
    collectorNumber: data.collectorNumber,
    nameKo: data.nameKo,
    rarity: data.rarity,
    illustrator: data.illustrator,
    setName: data.setName,
  };
}

export type RecentCard = { setCode: string; collectorNumber: string; nameKo: string };

// 홈 "최근 도안이 등록된 카드" (design 3A).
export async function recentArtworkCards(limit = 6): Promise<RecentCard[]> {
  const result = await db.execute(sql`select * from public.recent_artwork_cards(${limit})`);
  return (result.rows as { set_code: string; collector_number: string; name_ko: string }[]).map(
    (r) => ({
      setCode: r.set_code,
      collectorNumber: r.collector_number,
      nameKo: r.name_ko,
    }),
  );
}
