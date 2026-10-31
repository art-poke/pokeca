import { memberRoute } from "@/lib/member-route";
import { updateProfile } from "@/lib/members";

// 마이프로필 수정: 닉네임(필수) + 프로필 이미지(선택, 업로드 ID).
export const PATCH = memberRoute(async (request, _ctx, member) => {
  const body = await request.json();
  await updateProfile(member.userId, {
    nickname: String(body.nickname ?? ""),
    avatarUploadId: body.avatarUploadId ? String(body.avatarUploadId) : null,
  });
  return Response.json({ ok: true });
});
