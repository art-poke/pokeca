import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cards, events, searchMisses, sets } from "@/lib/db/schema";
import { jamoSimilarity } from "@/lib/hangul";
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
  // 공식 카드 이미지(S3 키). 검색 결과 격자에서 실제 그림을 보여주려고 보강한다. null이면 실루엣.
  imagePath: string | null;
  // 카드 자체의 언어/출처. ja=SNKRDUNK 일어판(한글판에 없는 카드). 뱃지·이미지 경로가 달라진다.
  lang: "ko" | "ja";
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
    imagePath: null, // 합성 타입 card_hit에는 image_path가 없어 아래 withImagePaths가 채운다.
    lang: "ko",
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
  // 일어판 gap 카드는 cards에 정식 편입돼 있어(마이그레이션), 검색 함수가 한글판과 함께 돌려준다.
  const hits = await withImagePaths((result.rows as CardHitRow[]).map(toHit));
  return { parsed, hits };
}

// card_hit 합성 타입에 image_path·lang이 없어, cardId로 한 번 더 조회해 채운다.
async function withImagePaths(hits: CardHit[]): Promise<CardHit[]> {
  if (hits.length === 0) return hits;
  const rows = await db
    .select({ id: cards.id, imagePath: cards.imagePath, lang: cards.lang })
    .from(cards)
    .where(inArray(cards.id, hits.map((h) => h.cardId)));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return hits.map((h) => {
    const r = byId.get(h.cardId);
    return { ...h, imagePath: r?.imagePath ?? null, lang: r?.lang === "ja" ? "ja" : "ko" };
  });
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
  // 공식 카드 이미지 경로(S3 키). null이면 실루엣.
  imagePath: string | null;
  lang: "ko" | "ja";
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
      imagePath: cards.imagePath,
      lang: cards.lang,
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
    imagePath: data.imagePath,
    lang: data.lang === "ja" ? "ja" : "ko",
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

// 격자 타일용 카드(그림 포함). 검색 랜딩 "둘러보기"와 오타 제안에 쓴다.
export type BrowseCard = {
  cardId: string;
  setCode: string;
  collectorNumber: string;
  nameKo: string;
  imagePath: string | null;
  artworkCount: number;
};

type BrowseRow = {
  id: string;
  set_code: string;
  collector_number: string;
  name_ko: string;
  image_path: string | null;
  artwork_count: number;
};

const toBrowse = (r: BrowseRow): BrowseCard => ({
  cardId: r.id,
  setCode: r.set_code,
  collectorNumber: r.collector_number,
  nameKo: r.name_ko,
  imagePath: r.image_path,
  artworkCount: r.artwork_count,
});

// 검색 랜딩 "도안 둘러보기" — 그림 있는 카드 중 하루 단위 고정 랜덤.
// md5(id || 오늘날짜)로 정렬해 하루 동안 순서가 안 바뀐다(세션 중 새로고침해도 동일, CDN 캐시에도 친화적).
// 그림 있는 카드(image_path not null)만 골라 빈 실루엣이 안 나오게 한다.
export async function randomCardsWithImages(limit = 12): Promise<BrowseCard[]> {
  const result = await db.execute(sql`
    select c.id, c.set_code, c.collector_number, c.name_ko, c.image_path,
           (select count(*)::int from public.artworks w
             where w.card_id = c.id and w.status = 'active') as artwork_count
    from public.cards c
    where c.image_path is not null and c.lang = 'ko'
    order by md5(c.id::text || current_date::text)
    limit ${limit}
  `);
  return (result.rows as BrowseRow[]).map(toBrowse);
}

// 이름 검색이 0건일 때 "이거 찾으셨나요?" 후보. pg_trgm 거리(<->)로 가까운 30개를 당긴 뒤
// 자모 레벤슈타인으로 재정렬한다. 음절 trigram만으로 못 잡는 받침 오타(핔카츄)를 자모로 보완.
export async function suggestCards(text: string, limit = 6): Promise<BrowseCard[]> {
  const q = text.trim();
  if (q.length < 1) return [];
  const result = await db.execute(sql`
    select c.id, c.set_code, c.collector_number, c.name_ko, c.image_path,
           (select count(*)::int from public.artworks w
             where w.card_id = c.id and w.status = 'active') as artwork_count
    from public.cards c
    order by c.name_ko operator(public.<->) ${q}
    limit 30
  `);
  return (result.rows as BrowseRow[])
    .map((r) => ({ card: toBrowse(r), score: jamoSimilarity(q, r.name_ko) }))
    .filter((x) => x.score >= 0.55)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.card);
}
