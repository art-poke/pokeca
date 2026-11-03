import { currentAdmin } from "@/lib/admin";
import { CommentError, deleteComment } from "@/lib/comments";
import { memberRoute } from "@/lib/artist-route";

// 댓글 삭제(본인 또는 어드민). soft delete.
export const DELETE = memberRoute(
  async (_request, ctx: RouteContext<"/api/comments/[id]">, member) => {
    const { id } = await ctx.params;
    const isAdmin = !!(await currentAdmin());
    try {
      await deleteComment(id, member.userId, isAdmin);
    } catch (e) {
      if (e instanceof CommentError) {
        return Response.json({ code: e.code }, { status: e.code === "forbidden" ? 403 : 400 });
      }
      throw e;
    }
    return Response.json({ ok: true });
  },
);
