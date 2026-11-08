import { searchCards } from "@/lib/cards";

// 카드 검색 페이지 조회(무한스크롤 2페이지+). 1페이지는 app/search가 SSR로 직접 lib을 부른다.
// 계측(recordSearch)은 1페이지에서만 하므로 여기선 하지 않는다(중복 집계 방지).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 100);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  if (!q.trim()) return Response.json({ hits: [], hasMore: false });
  const { hits, hasMore } = await searchCards(q, { offset, limit: 20 });
  return Response.json({ hits, hasMore });
}
