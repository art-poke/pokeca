import { CommentError, createComment } from "@/lib/comments";
import { memberRoute } from "@/lib/artist-route";

// 댓글 작성(회원). body: { target: 'artwork'|'post', targetId, body, parentId? }
export const POST = memberRoute(async (request, _ctx, member) => {
  const b = (await request.json()) as {
    target?: unknown;
    targetId?: unknown;
    body?: unknown;
    parentId?: unknown;
  };
  if (b.target !== "artwork" && b.target !== "post") {
    return Response.json({ code: "invalid_target" }, { status: 400 });
  }
  try {
    await createComment({
      target: b.target,
      targetId: String(b.targetId ?? ""),
      userId: member.userId,
      authorName: member.displayName,
      body: String(b.body ?? ""),
      parentId: typeof b.parentId === "string" ? b.parentId : null,
    });
  } catch (e) {
    if (e instanceof CommentError) return Response.json({ code: e.code }, { status: 400 });
    throw e;
  }
  return Response.json({ ok: true });
});
