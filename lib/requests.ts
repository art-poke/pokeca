import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { artworks, cardDemand, cards } from "@/lib/db/schema";
import type { Format } from "@/lib/formats";
import { UUID } from "@/lib/uuid";

// 찾기 요청 (design 5A, eng E5). 카드·규격·방문자 단위로 한 번만 센다.
// 카드 상세 HTML은 방문자와 무관하게 만들고, 요청 상태는 브라우저가 따로 불러온다 (eng R8).

export type RequestState = Record<Format, { requested: boolean; waiting: number | null }>;

export async function requestState(cardId: string, visitorId: string | null): Promise<RequestState> {
  // 규격별 요청 상태 집계는 plpgsql 함수(card_request_state)가 한다(TS 재구현 금지).
  const result = await db.execute(
    sql`select * from public.card_request_state(${cardId}, ${
      // 방문자 ID가 없으면 아무 요청과도 맞지 않는 값으로 조회한다.
      visitorId ?? "00000000-0000-0000-0000-000000000000"
    })`,
  );
  return Object.fromEntries(
    (result.rows as { format: Format; requested: boolean; waiting: number | null }[]).map((r) => [
      r.format,
      { requested: r.requested, waiting: r.waiting },
    ]),
  ) as RequestState;
}

export async function createRequest(cardId: string, format: Format, visitorId: string): Promise<void> {
  // 중복(카드×규격×방문자) 무시·이벤트 기록은 plpgsql 함수(request_create)가 한 트랜잭션에서 처리한다.
  await db.execute(sql`select public.request_create(${cardId}, ${format}, ${visitorId})`);
}

// 도안이 0개인 카드를 본 방문 (eng R11). 측정용이라 실패해도 화면을 막지 않는다.
export async function recordDemandIfEmpty(cardId: string, visitorId: string | null): Promise<void> {
  if (!visitorId) return;
  const rows = await db
    .select({ n: count() })
    .from(artworks)
    .where(and(eq(artworks.cardId, cardId), eq(artworks.status, "active")));
  if ((rows[0]?.n ?? 0) === 0) {
    await db.insert(cardDemand).values({ cardId, visitorId });
  }
}

export async function cardExists(cardId: string): Promise<boolean> {
  if (!UUID.test(cardId)) return false;
  const rows = await db.select({ id: cards.id }).from(cards).where(eq(cards.id, cardId)).limit(1);
  return !!rows[0];
}
