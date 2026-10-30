import { adminRoute } from "@/lib/admin-route";
import { createArtwork, type NewArtwork } from "@/lib/artworks";

// 2단계: 작품 생성 + 업로드 확정. body.id는 폼이 만든 UUID라 재시도해도 같은 작품이 된다.
// 허락 근거는 경로가 아니라 업로드 ID(body.uploads.evidence)로만 받는다.
export const POST = adminRoute(async (request, _ctx, admin) => {
  const body = await request.json();
  const input: NewArtwork = {
    id: String(body.id),
    cardId: String(body.cardId),
    artistName: String(body.artistName ?? ""),
    title: body.title ? String(body.title) : null,
    format: body.format,
    sourceUrl: body.sourceUrl || null,
    sourceVisibility: body.sourceUrl ? body.sourceVisibility : null,
    printSizeVerified: !!body.printSizeVerified,
  };
  const id = await createArtwork(input, body.uploads ?? {}, admin.email);
  return Response.json({ id }, { status: 201 });
});
