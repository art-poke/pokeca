import "server-only";
import { db } from "@/lib/supabase/server";
import { UUID } from "@/lib/uuid";

// 회원의 카드단위 도안 요청(규격별 "찾기요청"과 별개). 유저당 카드당 1회.
// 사이드바 "도안 요청해요" = 요청수 많은 카드 상단(요청방).

export async function requestArt(userId: string, cardId: string): Promise<void> {
  if (!UUID.test(cardId)) throw new Error("not_found");
  const { error } = await db().from("requests").insert({ card_id: cardId, user_id: userId });
  // 유저당 카드당 1회(unique). 재요청은 무시.
  if (error && error.code !== "23505") throw error;
}

export async function hasRequested(userId: string, cardId: string): Promise<boolean> {
  if (!UUID.test(cardId)) return false;
  const { data, error } = await db()
    .from("requests")
    .select("id")
    .eq("card_id", cardId)
    .eq("user_id", userId)
    .not("user_id", "is", null)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export type RequestedCard = {
  cardLabel: string;
  cardPath: string;
  name: string;
  count: number;
};

// 요청방 목록: 카드별 요청수(회원+익명 모두) 내림차순.
export async function listRequestedCards(limit = 50): Promise<RequestedCard[]> {
  const { data, error } = await db()
    .from("requests")
    .select("card_id, cards(set_code, collector_number, name_ko)")
    .returns<
      { card_id: string; cards: { set_code: string; collector_number: string; name_ko: string } }[]
    >();
  if (error) throw error;

  const agg = new Map<string, { n: number; card: (typeof data)[number]["cards"] }>();
  for (const r of data) {
    if (!r.cards) continue;
    const cur = agg.get(r.card_id);
    if (cur) cur.n += 1;
    else agg.set(r.card_id, { n: 1, card: r.cards });
  }

  return [...agg.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map(({ n, card }) => ({
      cardLabel: `${card.set_code} ${card.collector_number}`,
      cardPath: `/cards/${encodeURIComponent(card.set_code)}/${card.collector_number.replace("/", "-")}`,
      name: card.name_ko,
      count: n,
    }));
}
