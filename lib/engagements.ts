import "server-only";
import { ArtworkError } from "@/lib/artworks";
import { db } from "@/lib/supabase/server";

// 추천/다운로드 점수 (engagements). (유저, 도안)당 1행 = 1점, 중복불가.
//   다운로드(회원) → kind 'download', 추천(회원) → kind 'recommend'(토글). 둘은 배타.
//   작가 점수 = 자기 active 도안들의 engagement 수 / 도안 랭킹 = 추천 수.

export type EngagementKind = "download" | "recommend";

export async function getEngagement(
  userId: string,
  artworkId: string,
): Promise<EngagementKind | null> {
  const { data, error } = await db()
    .from("engagements")
    .select("kind")
    .eq("user_id", userId)
    .eq("artwork_id", artworkId)
    .maybeSingle<{ kind: EngagementKind }>();
  if (error) throw error;
  return data?.kind ?? null;
}

// 추천 토글. 이미 다운로드로 반영됐으면 막는다(배타).
export async function toggleRecommend(
  userId: string,
  artworkId: string,
): Promise<{ recommended: boolean }> {
  const client = db();
  const current = await getEngagement(userId, artworkId);
  if (current === "download") throw new ArtworkError("already_downloaded");
  if (current === "recommend") {
    const { error } = await client
      .from("engagements")
      .delete()
      .eq("user_id", userId)
      .eq("artwork_id", artworkId);
    if (error) throw error;
    return { recommended: false };
  }
  const { error } = await client
    .from("engagements")
    .insert({ user_id: userId, artwork_id: artworkId, kind: "recommend" });
  if (error && error.code !== "23505") throw error;
  return { recommended: true };
}

// 다운로드 점수 기록(없을 때만). 파일 서빙은 호출자가 별도로 한다.
// 이미 추천/다운로드로 engage했으면 점수는 그대로(1점 유지).
export async function recordDownloadEngagement(userId: string, artworkId: string): Promise<void> {
  const { error } = await db()
    .from("engagements")
    .insert({ user_id: userId, artwork_id: artworkId, kind: "download" });
  if (error && error.code !== "23505") throw error;
}

export async function recommendCount(artworkId: string): Promise<number> {
  const { count, error } = await db()
    .from("engagements")
    .select("*", { count: "exact", head: true })
    .eq("artwork_id", artworkId)
    .eq("kind", "recommend");
  if (error) throw error;
  return count ?? 0;
}
