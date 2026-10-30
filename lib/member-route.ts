import "server-only";
import { ArtworkError } from "@/lib/artworks";
import { currentMember, type Member } from "@/lib/members";
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
      if (e instanceof ArtworkError) {
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
