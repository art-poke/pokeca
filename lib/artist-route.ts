import "server-only";
import { currentArtist, type Artist } from "@/lib/artists";
import { ArtistError } from "@/lib/artists";
import { ArtworkError } from "@/lib/artworks";
import { FavoriteError } from "@/lib/favorites";
import { ReviewError } from "@/lib/reviews";
import { StorageInputError } from "@/lib/storage";

// 공통 에러 → 응답 매핑(adminRoute와 같은 모양). 입력 오류는 400 {code}.
function toResponse(e: unknown): Response {
  if (e instanceof ReviewError) {
    const status = e.code === "not_found" ? 404 : e.code === "forbidden" ? 403 : 400;
    return Response.json({ code: e.code }, { status });
  }
  if (e instanceof ArtworkError || e instanceof FavoriteError || e instanceof ArtistError) {
    return Response.json({ code: e.code }, { status: e.code === "not_found" ? 404 : 400 });
  }
  if (e instanceof StorageInputError || e instanceof SyntaxError) {
    return Response.json({ code: e instanceof SyntaxError ? "invalid_json" : e.message }, { status: 400 });
  }
  throw e;
}

// 로그인한 프로필이면 통과(= 옛 memberRoute). 댓글·즐겨찾기·추천·요청·후기 등.
export function profileRoute<C>(handler: (request: Request, ctx: C, profile: Artist) => Promise<Response>) {
  return async (request: Request, ctx: C): Promise<Response> => {
    const profile = await currentArtist();
    if (!profile) return Response.json({ code: "unauthorized" }, { status: 401 });
    try {
      return await handler(request, ctx, profile);
    } catch (e) {
      return toResponse(e);
    }
  };
}

// 발행 자격(handle 보유)이면 통과(= 옛 artistRoute). 도안 업로드/발행.
export function publisherRoute<C>(handler: (request: Request, ctx: C, artist: Artist) => Promise<Response>) {
  return async (request: Request, ctx: C): Promise<Response> => {
    const artist = await currentArtist();
    if (!artist) return Response.json({ code: "unauthorized" }, { status: 401 });
    if (!artist.handle) return Response.json({ code: "handle_required" }, { status: 403 });
    try {
      return await handler(request, ctx, artist);
    } catch (e) {
      return toResponse(e);
    }
  };
}

// 하위호환 alias.
export const memberRoute = profileRoute;
export const artistRoute = publisherRoute;
