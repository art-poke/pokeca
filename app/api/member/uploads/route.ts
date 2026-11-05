import { memberRoute } from "@/lib/artist-route";
import { createUpload } from "@/lib/storage";

// 회원 업로드 1단계: 서명 업로드 URL. 프로필(avatar)·후기(review)·커뮤니티 글(post) 이미지만 허용.
export const POST = memberRoute(async (request) => {
  const body = await request.json();
  if (body.kind !== "avatar" && body.kind !== "review" && body.kind !== "post") {
    return Response.json({ code: "invalid_kind" }, { status: 400 });
  }
  return Response.json(
    await createUpload({ kind: body.kind, mimeType: body.mimeType, sizeBytes: Number(body.sizeBytes) }),
  );
});
