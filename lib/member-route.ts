import "server-only";
import { ArtworkError } from "@/lib/artworks";
import { FavoriteError } from "@/lib/favorites";
import { currentMember, MemberError, type Member } from "@/lib/members";
import { ReviewError } from "@/lib/reviews";
import { StorageInputError } from "@/lib/storage";

// 회원 API 공통 처리: 로그인한 회원만. 입력 오류는 400 {code} (adminRoute·artistRoute와 같은 모양).
export function memberRoute<C>(
  handler: (request: Request, ctx: C, member: Member) => Promise<Response>,
) {
  return async (request: Request, ctx: C): Promise<Response> => {
    const member = await currentMember();
    if (!member) return Response.json({ code: "unauthorized" }, { status: 401 });
    try {
      return await handler(request, ctx, member);
    } catch (e) {
      if (e instanceof ReviewError) {
        const status = e.code === "not_found" ? 404 : e.code === "forbidden" ? 403 : 400;
        return Response.json({ code: e.code }, { status });
      }
      if (e instanceof ArtworkError || e instanceof FavoriteError || e instanceof MemberError) {
        return Response.json({ code: e.code }, { status: e.code === "not_found" ? 404 : 400 });
      }
      if (e instanceof StorageInputError || e instanceof SyntaxError) {
        return Response.json(
          { code: e instanceof SyntaxError ? "invalid_json" : e.message },
          { status: 400 },
        );
      }
      throw e;
    }
  };
}
