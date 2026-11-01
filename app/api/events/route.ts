import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { artworks, events } from "@/lib/db/schema";
import { visitorId } from "@/lib/visitor";
import { UUID } from "@/lib/uuid";

// 원본 글 클릭 측정 (설계 "측정"). 브라우저가 sendBeacon으로 보낸다. 실패해도 사용자에게는 보이지 않는다.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const artworkId = typeof body?.artworkId === "string" ? body.artworkId : "";
  if (body?.type !== "source_click" || !UUID.test(artworkId)) {
    return new Response(null, { status: 400 });
  }
  const visitor = await visitorId();
  after(async () => {
    const rows = await db
      .select({ cardId: artworks.cardId })
      .from(artworks)
      .where(eq(artworks.id, artworkId))
      .limit(1);
    const row = rows[0] ?? null;
    if (!row) return;
    try {
      await db.insert(events).values({
        type: "source_click",
        visitorId: visitor,
        artworkId,
        cardId: row.cardId,
      });
    } catch (error) {
      console.error("source_click event", error);
    }
  });
  return new Response(null, { status: 204 });
}
