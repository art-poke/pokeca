import { currentAdmin } from "@/lib/admin";
import { memberRoute } from "@/lib/member-route";
import { deleteReview } from "@/lib/reviews";

// 후기 삭제: 작성자 본인 또는 어드민.
export const DELETE = memberRoute(
  async (_request, ctx: RouteContext<"/api/reviews/[id]">, member) => {
    const { id } = await ctx.params;
    const admin = await currentAdmin();
    await deleteReview(id, member.userId, !!admin);
    return Response.json({ ok: true });
  },
);
