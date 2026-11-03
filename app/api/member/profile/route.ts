import { profileRoute } from "@/lib/artist-route";
import { setHandle, updateProfile } from "@/lib/artists";

// 마이프로필 수정: 표시명(필수) + 프로필 이미지(선택) + 발행용 주소 이름 handle(선택, 설정 시).
export const PATCH = profileRoute(async (request, _ctx, profile) => {
  const body = await request.json();
  await updateProfile(profile.userId, {
    displayName: String(body.displayName ?? ""),
    avatarUploadId: body.avatarUploadId ? String(body.avatarUploadId) : null,
  });
  if (body.handle) await setHandle(profile.userId, String(body.handle));
  return Response.json({ ok: true });
});
