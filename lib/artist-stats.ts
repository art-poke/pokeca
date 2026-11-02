import "server-only";
import { eq } from "drizzle-orm";
import { resolvedCountByArtist } from "@/lib/art-requests";
import { db } from "@/lib/db";
import { artworks, engagements } from "@/lib/db/schema";

export type ArtistStats = { recommends: number; downloads: number; resolved: number };

// 작가 대시보드 통계: 내 도안들이 받은 추천·다운로드 수 + 해결한 요청 수.
export async function artistStats(userId: string): Promise<ArtistStats> {
  const rows = await db
    .select({ kind: engagements.kind })
    .from(engagements)
    .innerJoin(artworks, eq(engagements.artworkId, artworks.id))
    .where(eq(artworks.artistId, userId));

  let recommends = 0;
  let downloads = 0;
  for (const e of rows) {
    if (e.kind === "recommend") recommends += 1;
    else downloads += 1;
  }
  const resolved = await resolvedCountByArtist(userId);
  return { recommends, downloads, resolved };
}
