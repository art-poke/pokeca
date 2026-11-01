import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { searchMisses } from "@/lib/db/schema";
import { parseQuery } from "@/lib/search";
import { visitorId } from "@/lib/visitor";

// 못 찾은 카드의 찾기 요청 (design 6A). 같은 방문자가 같은 검색어로 다시 눌러도 한 번만 남긴다.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query.trim().slice(0, 100) : "";
  const parsed = parseQuery(query);
  if (parsed.kind === "empty") return new Response(null, { status: 400 });

  const visitor = await visitorId();
  if (visitor) {
    try {
      const rows = await db
        .select({ id: searchMisses.id })
        .from(searchMisses)
        .where(
          and(
            eq(searchMisses.visitorId, visitor),
            eq(searchMisses.query, query),
            eq(searchMisses.requested, true),
          ),
        )
        .limit(1);
      if (rows.length > 0) return new Response(null, { status: 204 });
    } catch {
      return new Response(null, { status: 500 });
    }
  }
  try {
    await db.insert(searchMisses).values({ query, parsed, visitorId: visitor, requested: true });
  } catch {
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
