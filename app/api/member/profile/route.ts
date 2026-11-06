import { profileRoute } from "@/lib/artist-route";
import { setHandle, updateProfile } from "@/lib/artists";

// 마이프로필 수정: 표시명(필수) + 프로필 이미지(선택) + 발행용 주소 이름 handle(선택, 설정 시).
export const PATCH = profileRoute(async (request, _ctx, profile) => {
  const body = await request.json();
  await updateProfile(profile.userId, {
    displayName: String(body.displayName ?? ""),
    avatarUploadId: body.avatarUploadId ? String(body.avatarUploadId) : null,
    email: body.email !== undefined ? (body.email === null ? null : String(body.email)) : undefined,
    intro: body.intro !== undefined ? (body.intro === null ? null : String(body.intro)) : undefined,
    links: body.links !== undefined ? body.links : undefined,
    activities: body.activities !== undefined ? body.activities : undefined,
  });
  if (body.handle) await setHandle(profile.userId, String(body.handle));
  return Response.json({ ok: true });
});
