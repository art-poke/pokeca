import { searchArtists } from "@/lib/artists";

// 작가 이름/핸들 검색(커뮤니티 후기에서 작가 고르기). 공개 조회.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (!q.trim()) return Response.json([]);
  return Response.json(await searchArtists(q));
}
