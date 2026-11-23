import { recordActivity } from "@/lib/analytics/write";
import { after } from "next/server";
import { artRequestState, requestArt } from "@/lib/art-requests";
import { memberRoute } from "@/lib/artist-route";
import { currentMember } from "@/lib/artists";
import { isFormat } from "@/lib/formats";
import { cardExists, recordDemandIfEmpty } from "@/lib/requests";
import { visitorId } from "@/lib/visitor";

// 대기 인원은 공개하고, 내 요청 여부는 로그인한 계정으로 조회한다.
export async function GET(_request: Request, ctx: RouteContext<"/api/cards/[id]/requests">) {
  const { id } = await ctx.params;
  if (!(await cardExists(id))) return Response.json({ code: "not_found" }, { status: 404 });
  const [visitor, member] = await Promise.all([visitorId(), currentMember()]);
  after(() => recordDemandIfEmpty(id, visitor).catch((e) => console.error("card_demand", e)));
  return Response.json(await artRequestState(id, member?.userId ?? null), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export const POST = memberRoute(
  async (request, ctx: RouteContext<"/api/cards/[id]/requests">, member) => {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    if (!isFormat(body?.format)) return Response.json({ code: "invalid_format" }, { status: 400 });
    if (!(await cardExists(id))) return Response.json({ code: "not_found" }, { status: 404 });
    if (await requestArt(member.userId, id, body.format)) await recordActivity("request_created", member.userId,{id});
    return Response.json(await artRequestState(id, member.userId));
  },
);
