import "server-only";
import { and, count, eq } from "drizzle-orm";
import { ArtworkError } from "@/lib/artworks";
import { db } from "@/lib/db";
import { engagements } from "@/lib/db/schema";
import { isUniqueViolation } from "@/lib/db/errors";

// 추천/다운로드 점수 (engagements). (유저, 도안)당 1행 = 1점, 중복불가.
//   다운로드(회원) → kind 'download', 추천(회원) → kind 'recommend'(토글). 둘은 배타.
//   작가 점수 = 자기 active 도안들의 engagement 수 / 도안 랭킹 = 추천 수.

export type EngagementKind = "download" | "recommend";

export async function getEngagement(
  userId: string,
  artworkId: string,
): Promise<EngagementKind | null> {
  const rows = await db
    .select({ kind: engagements.kind })
    .from(engagements)
    .where(and(eq(engagements.userId, userId), eq(engagements.artworkId, artworkId)))
    .limit(1);
  return (rows[0]?.kind as EngagementKind | undefined) ?? null;
}

// 추천 토글. 이미 다운로드로 반영됐으면 막는다(배타).
export async function toggleRecommend(
  userId: string,
  artworkId: string,
): Promise<{ recommended: boolean }> {
  const current = await getEngagement(userId, artworkId);
  if (current === "download") throw new ArtworkError("already_downloaded");
  if (current === "recommend") {
    await db
      .delete(engagements)
      .where(and(eq(engagements.userId, userId), eq(engagements.artworkId, artworkId)));
    return { recommended: false };
  }
  try {
    await db.insert(engagements).values({ userId, artworkId, kind: "recommend" });
  } catch (e) {
    // 동시 요청 경합: 이미 있으면 추천된 것으로 본다.
    if (!isUniqueViolation(e)) throw e;
  }
  return { recommended: true };
}

// 다운로드 점수 기록(없을 때만). 파일 서빙은 호출자가 별도로 한다.
// 이미 추천/다운로드로 engage했으면 점수는 그대로(1점 유지).
export async function recordDownloadEngagement(userId: string, artworkId: string): Promise<void> {
  try {
    await db.insert(engagements).values({ userId, artworkId, kind: "download" });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
  }
}

export async function recommendCount(artworkId: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(engagements)
    .where(and(eq(engagements.artworkId, artworkId), eq(engagements.kind, "recommend")));
  return rows[0]?.n ?? 0;
}
