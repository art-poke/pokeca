import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { artworks, events } from "@/lib/db/schema";
import { visitorId } from "@/lib/visitor";
import { UUID } from "@/lib/uuid";
import { parseTrackedEvent } from "@/lib/analytics/events";

// 측정 이벤트 수집. 브라우저가 sendBeacon으로 보낸다. 실패해도 사용자에게는 보이지 않는다.
// 응답 전 동기 insert — Lambda가 응답 후 freeze되면 after() 작업이 유실될 수 있어 after()를 쓰지 않는다 (eng review R2).
// 종류: source_click(원본 글 클릭·artwork→card 매핑 필요) / page_view·page_leave·click(행동 추적).
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const type = (body as { type?: unknown } | null)?.type;
  const visitor = await visitorId();

  if (type === "source_click") {
    const artworkId = typeof (body as { artworkId?: unknown }).artworkId === "string" ? (body as { artworkId: string }).artworkId : "";
    if (!UUID.test(artworkId)) return new Response(null, { status: 400 });
    const rows = await db
      .select({ cardId: artworks.cardId })
      .from(artworks)
      .where(eq(artworks.id, artworkId))
      .limit(1);
    const row = rows[0];
    if (!row) return new Response(null, { status: 400 });
    try {
      await db.insert(events).values({ type: "source_click", visitorId: visitor, artworkId, cardId: row.cardId });
    } catch (error) {
      console.error("source_click event", error);
    }
    return new Response(null, { status: 204 });
  }

  const parsed = parseTrackedEvent(body, request.headers.get("user-agent"));
  if (parsed.outcome === "invalid") return new Response(null, { status: 400 });
  if (parsed.outcome === "skip") return new Response(null, { status: 204 });
  try {
    await db.insert(events).values({ type: parsed.type, visitorId: visitor, payload: parsed.payload });
  } catch (error) {
    console.error("track event", error);
  }
  return new Response(null, { status: 204 });
}
