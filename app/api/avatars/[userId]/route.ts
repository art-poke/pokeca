import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { signedViewUrl } from "@/lib/storage";
import { UUID } from "@/lib/uuid";

// 프로필 이미지: 회원의 avatar_path를 짧은 서명 URL로 보낸다. 없으면 404(화면은 이니셜로 대체).
export async function GET(_request: Request, ctx: RouteContext<"/api/avatars/[userId]">) {
  const { userId } = await ctx.params;
  if (!UUID.test(userId)) return new Response(null, { status: 404 });
  const rows = await db
    .select({ avatarPath: members.avatarPath })
    .from(members)
    .where(eq(members.userId, userId))
    .limit(1);
  const row = rows[0] ?? null;
  if (!row?.avatarPath) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { Location: await signedViewUrl(row.avatarPath), "Cache-Control": "private, max-age=240" },
  });
}
