import { reviewImageOf } from "@/lib/reviews";
import { signedViewUrl } from "@/lib/storage";

// 후기 이미지: image_path를 짧은 서명 URL로 보낸다. 없으면 404.
export async function GET(_request: Request, ctx: RouteContext<"/api/reviews/[id]/image">) {
  const { id } = await ctx.params;
  const path = await reviewImageOf(id);
  if (!path) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { Location: await signedViewUrl(path), "Cache-Control": "private, max-age=240" },
  });
}
