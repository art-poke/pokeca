import "server-only";
import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import { FORMAT_INFO, type Format, isFormat } from "@/lib/formats";
import { db } from "@/lib/db";
import { cards, requests } from "@/lib/db/schema";
import { isUniqueViolation } from "@/lib/db/errors";
import { UUID } from "@/lib/uuid";

// 회원 규격별 도안 요청 + 요청방(카드×규격 요청수) + 작가 업로드 시 해결 처리.

export async function requestArt(userId: string, cardId: string, format: Format): Promise<void> {
  if (!UUID.test(cardId)) throw new Error("not_found");
  if (!isFormat(format)) throw new Error("invalid_format");
  try {
    await db.insert(requests).values({ cardId, userId, format });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e; // 이미 요청했으면 무시
  }
}

// 이 회원이 이 카드에 올린 미해결 요청 규격들.
export async function requestedFormats(userId: string, cardId: string): Promise<Format[]> {
  if (!UUID.test(cardId)) return [];
  const data = await db
    .select({ format: requests.format })
    .from(requests)
    .where(
      and(eq(requests.cardId, cardId), eq(requests.userId, userId), isNull(requests.resolvedAt)),
    );
  return data.map((r) => r.format).filter((f): f is Format => isFormat(f));
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
  const data = await db
    .select({
      cardId: requests.cardId,
      format: requests.format,
      setCode: cards.setCode,
      collectorNumber: cards.collectorNumber,
      nameKo: cards.nameKo,
    })
    .from(requests)
    .innerJoin(cards, eq(requests.cardId, cards.id))
    .where(and(isNull(requests.resolvedAt), isNotNull(requests.format)));

  const agg = new Map<
    string,
    { n: number; card: { setCode: string; collectorNumber: string; nameKo: string }; format: Format }
  >();
  for (const r of data) {
    if (!isFormat(r.format)) continue;
    const key = `${r.cardId}:${r.format}`;
    const cur = agg.get(key);
    if (cur) cur.n += 1;
    else
      agg.set(key, {
        n: 1,
        card: { setCode: r.setCode, collectorNumber: r.collectorNumber, nameKo: r.nameKo },
        format: r.format,
      });
  }

  return [...agg.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map(({ n, card, format }) => ({
      cardLabel: `${card.setCode} ${card.collectorNumber}`,
      cardPath: `/cards/${encodeURIComponent(card.setCode)}/${card.collectorNumber.replace("/", "-")}`,
      name: card.nameKo,
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
  await db
    .update(requests)
    .set({ resolvedAt: new Date(), resolvedBy })
    .where(
      and(eq(requests.cardId, cardId), eq(requests.format, format), isNull(requests.resolvedAt)),
    );
}

// 작가가 해결한 요청 수(프로필 표시).
export async function resolvedCountByArtist(userId: string): Promise<number> {
  if (!UUID.test(userId)) return 0;
  const rows = await db
    .select({ n: count() })
    .from(requests)
    .where(eq(requests.resolvedBy, userId));
  return rows[0]?.n ?? 0;
}
