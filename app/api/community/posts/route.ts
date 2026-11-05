import { currentAdmin } from "@/lib/admin";
import { createPost, PostError } from "@/lib/community";
import { memberRoute } from "@/lib/artist-route";

// 게시글 작성(회원). 공지는 어드민만. body: { board, title, body, imageUploadId? }
export const POST = memberRoute(async (request, _ctx, member) => {
  const b = (await request.json()) as {
    board?: unknown;
    title?: unknown;
    body?: unknown;
    imageUploadId?: unknown;
  };
  const isAdmin = !!(await currentAdmin());
  try {
    const id = await createPost({
      board: b.board as never,
      userId: member.userId,
      authorName: member.displayName,
      title: String(b.title ?? ""),
      body: String(b.body ?? ""),
      isAdmin,
      imageUploadId: b.imageUploadId ? String(b.imageUploadId) : null,
    });
    return Response.json({ id });
  } catch (e) {
    if (e instanceof PostError) {
      return Response.json({ code: e.code }, { status: e.code === "forbidden" ? 403 : 400 });
    }
    throw e;
  }
});
