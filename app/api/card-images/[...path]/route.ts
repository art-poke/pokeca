import { viewUrl } from "@/lib/storage-client";

// 공식 카드 이미지(uploads 버킷 cards/…)는 비공개 버킷에 있으므로 짧은 서명 URL로 보낸다.
// 키는 cards/{세트}/{세트}_{번호}.webp 꼴만 허용한다(경로 탐색 방지).
const KEY = /^[A-Za-z0-9]+\/[A-Za-z0-9]+_[A-Za-z0-9]+\.webp$/;

export async function GET(_request: Request, ctx: RouteContext<"/api/card-images/[...path]">) {
  const { path } = await ctx.params;
  const rel = path.join("/");
  if (!KEY.test(rel)) return new Response(null, { status: 404 });
  const url = await viewUrl("artworks", `cards/${rel}`, { ttl: 3600 });
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "public, max-age=3000" },
  });
}
