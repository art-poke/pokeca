import { signedViewUrl } from "@/lib/storage";
import { db } from "@/lib/supabase/server";
import { UUID } from "@/lib/uuid";

// 프로필 이미지: 회원의 avatar_path를 짧은 서명 URL로 보낸다. 없으면 404(화면은 이니셜로 대체).
export async function GET(_request: Request, ctx: RouteContext<"/api/avatars/[userId]">) {
  const { userId } = await ctx.params;
  if (!UUID.test(userId)) return new Response(null, { status: 404 });
  const { data, error } = await db()
    .from("members")
    .select("avatar_path")
    .eq("user_id", userId)
    .maybeSingle<{ avatar_path: string | null }>();
  if (error) throw error;
  if (!data?.avatar_path) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { Location: await signedViewUrl(data.avatar_path), "Cache-Control": "private, max-age=240" },
  });
}
