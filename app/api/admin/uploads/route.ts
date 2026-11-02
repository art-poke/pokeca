import { adminRoute } from "@/lib/admin-route";
import { createUpload } from "@/lib/storage";

// 1단계: S3 presigned PUT URL 발급. 파일은 브라우저에서 S3로 직접 올라가며 이 라우트/Lambda 본문을 거치지 않는다.
export const POST = adminRoute(async (request) => {
  const body = await request.json();
  return Response.json(
    await createUpload({ kind: body.kind, mimeType: body.mimeType, sizeBytes: Number(body.sizeBytes) }),
  );
});
