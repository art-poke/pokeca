import { after } from "next/server";
import { resolveDownload } from "@/lib/artworks";
import { recordDownloadEngagement } from "@/lib/engagements";
import { currentMember } from "@/lib/members";
import { db } from "@/lib/supabase/server";
import { visitorId } from "@/lib/visitor";

// 다운로드는 회원 전용(에픽 결정). 서명 URL은 5분 뒤 만료되므로 화면에 남기지 않는다.
// 비회원 401, 없는 작품 404, 숨김·철회·허락 밖 410 {"code":"unavailable"}.
export async function POST(_request: Request, ctx: RouteContext<"/api/download/[id]">) {
  const { id } = await ctx.params;

  const member = await currentMember();
  if (!member) return Response.json({ code: "unauthorized" }, { status: 401 });

  const result = await resolveDownload(id);
  if (result.kind === "not_found") return Response.json({ code: "not_found" }, { status: 404 });
  if (result.kind === "unavailable") return Response.json({ code: "unavailable" }, { status: 410 });

  // 점수 기록(누가 받았는지, 없을 때만 1점) + 측정 이벤트(익명 집계 유지).
  await recordDownloadEngagement(member.userId, id);
  const visitor = await visitorId();
  after(async () => {
    const { error } = await db()
      .from("events")
      .insert({ type: "download", visitor_id: visitor, artwork_id: id });
    if (error) console.error("download event", error);
  });

  return Response.json({ url: result.url }, { headers: { "Cache-Control": "no-store" } });
}
