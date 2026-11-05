import { postImageOf } from "@/lib/community";
import { signedViewUrl } from "@/lib/storage";

// 게시글 이미지: image_path를 짧은 서명 URL로 보낸다. 없으면 404.
export async function GET(_request: Request, ctx: RouteContext<"/api/community/posts/[id]/image">) {
  const { id } = await ctx.params;
  const path = await postImageOf(id);
  if (!path) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { Location: await signedViewUrl(path), "Cache-Control": "private, max-age=240" },
  });
}
