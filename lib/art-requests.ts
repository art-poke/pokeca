import "server-only";
import { FORMAT_INFO, type Format, isFormat } from "@/lib/formats";
import { db } from "@/lib/supabase/server";
import { UUID } from "@/lib/uuid";

// 회원 규격별 도안 요청 + 요청방(카드×규격 요청수) + 작가 업로드 시 해결 처리.

export async function requestArt(userId: string, cardId: string, format: Format): Promise<void> {
  if (!UUID.test(cardId)) throw new Error("not_found");
  if (!isFormat(format)) throw new Error("invalid_format");
  const { error } = await db()
    .from("requests")
    .insert({ card_id: cardId, user_id: userId, format });
  if (error && error.code !== "23505") throw error; // 이미 요청했으면 무시
}

// 이 회원이 이 카드에 올린 미해결 요청 규격들.
export async function requestedFormats(userId: string, cardId: string): Promise<Format[]> {
  if (!UUID.test(cardId)) return [];
  const { data, error } = await db()
    .from("requests")
    .select("format")
    .eq("card_id", cardId)
    .eq("user_id", userId)
    .is("resolved_at", null);
  if (error) throw error;
  return (data ?? []).map((r) => r.format).filter(isFormat);
}

export type RequestedItem = {
  cardLabel: string;
  cardPath: string;
  name: string;
  format: Format;
  formatLabel: string;
  count: number;
};

// 요청방: (카드×규격)별 미해결 요청 수, 내림차순.
export async function listOpenRequests(limit = 100): Promise<RequestedItem[]> {
  const { data, error } = await db()
    .from("requests")
    .select("card_id, format, cards(set_code, collector_number, name_ko)")
    .is("resolved_at", null)
    .not("format", "is", null)
    .returns<
      {
        card_id: string;
        format: Format;
        cards: { set_code: string; collector_number: string; name_ko: string };
      }[]
    >();
  if (error) throw error;

  const agg = new Map<string, { n: number; card: (typeof data)[number]["cards"]; format: Format }>();
  for (const r of data) {
    if (!r.cards || !isFormat(r.format)) continue;
    const key = `${r.card_id}:${r.format}`;
    const cur = agg.get(key);
    if (cur) cur.n += 1;
    else agg.set(key, { n: 1, card: r.cards, format: r.format });
  }

  return [...agg.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map(({ n, card, format }) => ({
      cardLabel: `${card.set_code} ${card.collector_number}`,
      cardPath: `/cards/${encodeURIComponent(card.set_code)}/${card.collector_number.replace("/", "-")}`,
      name: card.name_ko,
      format,
      formatLabel: FORMAT_INFO[format].label,
      count: n,
    }));
}

// 작가/어드민이 카드×규격 도안을 올리면 그 규격의 미해결 요청을 해결 처리한다.
export async function resolveRequests(
  cardId: string,
  format: Format,
  resolvedBy: string | null,
): Promise<void> {
  if (!UUID.test(cardId) || !isFormat(format)) return;
  const { error } = await db()
    .from("requests")
    .update({ resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
    .eq("card_id", cardId)
    .eq("format", format)
    .is("resolved_at", null);
  if (error) throw error;
}

// 작가가 해결한 요청 수(프로필 표시).
export async function resolvedCountByArtist(userId: string): Promise<number> {
  if (!UUID.test(userId)) return 0;
  const { count, error } = await db()
    .from("requests")
    .select("*", { count: "exact", head: true })
    .eq("resolved_by", userId);
  if (error) throw error;
  return count ?? 0;
}
