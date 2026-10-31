import "server-only";
import { resolvedCountByArtist } from "@/lib/art-requests";
import { db } from "@/lib/supabase/server";

export type ArtistStats = { recommends: number; downloads: number; resolved: number };

// 작가 대시보드 통계: 내 도안들이 받은 추천·다운로드 수 + 해결한 요청 수.
export async function artistStats(userId: string): Promise<ArtistStats> {
  const { data, error } = await db()
    .from("engagements")
    .select("kind, artworks!inner(artist_id)")
    .eq("artworks.artist_id", userId)
    .returns<{ kind: "download" | "recommend" }[]>();
  if (error) throw error;

  let recommends = 0;
  let downloads = 0;
  for (const e of data) {
    if (e.kind === "recommend") recommends += 1;
    else downloads += 1;
  }
  const resolved = await resolvedCountByArtist(userId);
  return { recommends, downloads, resolved };
}
