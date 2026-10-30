import { requestArt } from "@/lib/art-requests";
import { memberRoute } from "@/lib/member-route";

// 카드단위 도안 요청(회원). 유저당 카드당 1회.
export const POST = memberRoute(
  async (_request, ctx: RouteContext<"/api/cards/[id]/request">, member) => {
    const { id } = await ctx.params;
    await requestArt(member.userId, id);
    return Response.json({ ok: true });
  },
);
