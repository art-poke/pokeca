import "server-only";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { artworks, cards, favorites, sets } from "@/lib/db/schema";
import { isUniqueViolation } from "@/lib/db/errors";
import { UUID } from "@/lib/uuid";

// 카드 즐겨찾기 (20261031000006). (회원, 카드)당 1행. 마이프로필에서 모아 본다.

export class FavoriteError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export async function isFavorited(userId: string, cardId: string): Promise<boolean> {
  if (!UUID.test(cardId)) return false;
  const rows = await db
    .select({ cardId: favorites.cardId })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.cardId, cardId)))
    .limit(1);
  return !!rows[0];
}

// 즐겨찾기 토글. 반환값 = 토글 후 즐겨찾기 상태(true=추가됨).
export async function toggleFavorite(userId: string, cardId: string): Promise<boolean> {
  if (!UUID.test(cardId)) throw new FavoriteError("not_found");
  // 카드가 실제로 있어야 한다(FK로도 막히지만 친절한 코드로).
  const card = await db.select({ id: cards.id }).from(cards).where(eq(cards.id, cardId)).limit(1);
  if (!card[0]) throw new FavoriteError("not_found");

  const existing = await db
    .select({ cardId: favorites.cardId })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.cardId, cardId)))
    .limit(1);

  if (existing[0]) {
    await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.cardId, cardId)));
    return false;
  }
  try {
    await db.insert(favorites).values({ userId, cardId });
  } catch (e) {
    // 동시 요청 경합: 이미 있으면 추가된 것으로 본다.
    if (!isUniqueViolation(e)) throw e;
  }
  return true;
}

export type FavoriteCard = {
  cardId: string;
  label: string; // "sv2a 201/165"
  name: string;
  setName: string;
  path: string;
  artworkCount: number;
};

// 마이프로필: 내가 즐겨찾기한 카드 목록(최근 순). 카드마다 공개 도안 수도 함께.
export async function listFavoriteCards(userId: string): Promise<FavoriteCard[]> {
  const rows = await db
    .select({
      cardId: favorites.cardId,
      setCode: cards.setCode,
      collectorNumber: cards.collectorNumber,
      nameKo: cards.nameKo,
      setName: sets.nameKo,
    })
    .from(favorites)
    .innerJoin(cards, eq(favorites.cardId, cards.id))
    .leftJoin(sets, eq(cards.setCode, sets.code))
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));

  // 카드별 도안 수(전체). 즐겨찾기 카드만 각각 집계한다.
  const counts = new Map<string, number>();
  await Promise.all(
    rows.map(async (r) => {
      const c = await db
        .select({ n: count() })
        .from(artworks)
        .where(eq(artworks.cardId, r.cardId));
      counts.set(r.cardId, c[0]?.n ?? 0);
    }),
  );

  return rows.map((r) => ({
    cardId: r.cardId,
    label: `${r.setCode} ${r.collectorNumber}`,
    name: r.nameKo,
    setName: r.setName ?? r.setCode,
    path: `/cards/${encodeURIComponent(r.setCode)}/${r.collectorNumber.replace("/", "-")}`,
    artworkCount: counts.get(r.cardId) ?? 0,
  }));
}
