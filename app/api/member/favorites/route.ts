import { toggleFavorite } from "@/lib/favorites";
import { memberRoute } from "@/lib/member-route";

// 카드 즐겨찾기 토글. body.cardId. 반환값 { favorited: boolean }(토글 후 상태).
export const POST = memberRoute(async (request, _ctx, member) => {
  const body = await request.json();
  const favorited = await toggleFavorite(member.userId, String(body.cardId));
  return Response.json({ favorited });
});
