import { auth } from "@/auth";
import {
  actions,
  browserEvents,
  pageNames,
  placements,
} from "@/lib/analytics/taxonomy";
import { writeEvent } from "@/lib/analytics/write";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { artworks } from "@/lib/db/schema";
import { UUID } from "@/lib/uuid";

// 원본 글 클릭 측정 (설계 "측정"). 브라우저가 sendBeacon으로 보낸다. 실패해도 사용자에게는 보이지 않는다.
export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return new Response(null, { status: 403 });
  const raw = await request.text();
  if (raw.length > 4096) return new Response(null, { status: 413 });
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (browserEvents.has(body?.type)) {
    if (
      !pageNames.has(body.page) ||
      typeof body.eventId !== "string" ||
      !UUID.test(body.eventId)
    )
      return new Response(null, { status: 400 });
    if (
      /bot|crawler|spider|headless|lighthouse/i.test(
        request.headers.get("user-agent") ?? "",
      )
    )
      return new Response(null, { status: 204 });
    const payload: Record<string, string> = { page: body.page };
    if (body.type.startsWith("cta_") || body.type === "login_prompt_viewed") {
      if (!actions.has(body.action) || !placements.has(body.placement))
        return new Response(null, { status: 400 });
      Object.assign(payload, {
        action: body.action,
        placement: body.placement,
      });
    }
    for (const name of [
      "ref",
      "source",
      "medium",
      "campaign",
      "game",
      "round",
      "landing",
    ]) {
      const value = body[name];
      if (typeof value === "string" && /^[\p{L}\p{N}._ -]{1,80}$/u.test(value))
        payload[name] = value;
    }
    await writeEvent(
      body.type,
      (await auth())?.user?.id || null,
      payload,
      body.eventId,
    );
    return new Response(null, { status: 204 });
  }
  const artworkId = typeof body?.artworkId === "string" ? body.artworkId : "";
  if (body?.type !== "source_click" || !UUID.test(artworkId)) {
    return new Response(null, { status: 400 });
  }
  const [row] = await db
    .select({ cardId: artworks.cardId })
    .from(artworks)
    .where(eq(artworks.id, artworkId))
    .limit(1);
  if (row) {
    const member = (await auth())?.user?.id || null;
    await writeEvent("source_click", member, {}, undefined, {
      artworkId,
      cardId: row.cardId,
    });
  }
  return new Response(null, { status: 204 });
}
