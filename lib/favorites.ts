import "server-only";
import { db } from "@/lib/supabase/server";
import { UUID } from "@/lib/uuid";

// 카드 즐겨찾기 (20261031000006). (회원, 카드)당 1행. 마이프로필에서 모아 본다.

export class FavoriteError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export async function isFavorited(userId: string, cardId: string): Promise<boolean> {
  if (!UUID.test(cardId)) return false;
  const { data, error } = await db()
    .from("favorites")
    .select("card_id")
    .eq("user_id", userId)
    .eq("card_id", cardId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

// 즐겨찾기 토글. 반환값 = 토글 후 즐겨찾기 상태(true=추가됨).
export async function toggleFavorite(userId: string, cardId: string): Promise<boolean> {
  if (!UUID.test(cardId)) throw new FavoriteError("not_found");
  // 카드가 실제로 있어야 한다(FK로도 막히지만 친절한 코드로).
  const card = await db().from("cards").select("id").eq("id", cardId).maybeSingle();
  if (card.error) throw card.error;
  if (!card.data) throw new FavoriteError("not_found");

  const existing = await db()
    .from("favorites")
    .select("card_id")
    .eq("user_id", userId)
    .eq("card_id", cardId)
    .maybeSingle();
  if (existing.error) throw existing.error;

  if (existing.data) {
    const { error } = await db().from("favorites").delete().eq("user_id", userId).eq("card_id", cardId);
    if (error) throw error;
    return false;
  }
  const { error } = await db().from("favorites").insert({ user_id: userId, card_id: cardId });
  // 동시 요청 경합: 이미 있으면 추가된 것으로 본다.
  if (error && error.code !== "23505") throw error;
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

type Row = {
  card_id: string;
  created_at: string;
  cards: {
    set_code: string;
    collector_number: string;
    name_ko: string;
    sets: { name_ko: string } | null;
    artworks: { count: number }[];
  };
};

// 마이프로필: 내가 즐겨찾기한 카드 목록(최근 순). 카드마다 공개 도안 수도 함께.
export async function listFavoriteCards(userId: string): Promise<FavoriteCard[]> {
  const { data, error } = await db()
    .from("favorites")
    .select(
      "card_id, created_at, cards(set_code, collector_number, name_ko, sets(name_ko), artworks(count))",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<Row[]>();
  if (error) throw error;
  return data.map((r) => ({
    cardId: r.card_id,
    label: `${r.cards.set_code} ${r.cards.collector_number}`,
    name: r.cards.name_ko,
    setName: r.cards.sets?.name_ko ?? r.cards.set_code,
    path: `/cards/${encodeURIComponent(r.cards.set_code)}/${r.cards.collector_number.replace("/", "-")}`,
    artworkCount: r.cards.artworks[0]?.count ?? 0,
  }));
}
