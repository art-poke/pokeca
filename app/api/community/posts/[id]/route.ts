import { currentAdmin } from "@/lib/admin";
import { deletePost, PostError } from "@/lib/community";
import { memberRoute } from "@/lib/artist-route";

// 게시글 삭제(본인 또는 어드민). soft delete.
export const DELETE = memberRoute(
  async (_request, ctx: RouteContext<"/api/community/posts/[id]">, member) => {
    const { id } = await ctx.params;
    const isAdmin = !!(await currentAdmin());
    try {
      await deletePost(id, member.userId, isAdmin);
    } catch (e) {
      if (e instanceof PostError) {
        return Response.json({ code: e.code }, { status: e.code === "forbidden" ? 403 : 400 });
      }
      throw e;
    }
    return Response.json({ ok: true });
  },
);
