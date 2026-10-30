import { toggleRecommend } from "@/lib/engagements";
import { memberRoute } from "@/lib/member-route";

// 도안 추천 토글(회원 전용). 이미 다운로드로 반영된 도안은 400 {code:'already_downloaded'}.
export const POST = memberRoute(
  async (_request, ctx: RouteContext<"/api/artworks/[id]/recommend">, member) => {
    const { id } = await ctx.params;
    const result = await toggleRecommend(member.userId, id);
    return Response.json(result);
  },
);
