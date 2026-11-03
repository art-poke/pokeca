import { requestArt } from "@/lib/art-requests";
import { isFormat } from "@/lib/formats";
import { memberRoute } from "@/lib/artist-route";

// 카드×규격 도안 요청(회원). body: { format }
export const POST = memberRoute(
  async (request, ctx: RouteContext<"/api/cards/[id]/request">, member) => {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { format?: unknown };
    if (!isFormat(body.format)) return Response.json({ code: "invalid_format" }, { status: 400 });
    await requestArt(member.userId, id, body.format);
    return Response.json({ ok: true });
  },
);
