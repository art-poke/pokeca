import { memberRoute } from "@/lib/artist-route";
import { createUpload } from "@/lib/storage";

// 회원 업로드 1단계: 서명 업로드 URL. 프로필(avatar)·후기 이미지(review)만 허용한다.
export const POST = memberRoute(async (request) => {
  const body = await request.json();
  if (body.kind !== "avatar" && body.kind !== "review") {
    return Response.json({ code: "invalid_kind" }, { status: 400 });
  }
  return Response.json(
    await createUpload({ kind: body.kind, mimeType: body.mimeType, sizeBytes: Number(body.sizeBytes) }),
  );
});
