import "server-only";
import { db } from "@/lib/supabase/server";
import { FORMAT_INFO, type Format } from "@/lib/formats";

// 랭킹 (engagements 집계). 금주(월요일 시작)·이번달·역대.
//   작가 랭킹 = 자기 active 도안들의 engagement(다운로드+추천) 수.
//   도안 랭킹 = 추천 수.
// 초기엔 JS 집계(데이터 적음). 규모 커지면 집계 뷰/테이블로 최적화.

export type RankPeriod = "week" | "month" | "all";
export const RANK_PERIODS: RankPeriod[] = ["week", "month", "all"];
export const PERIOD_LABEL: Record<RankPeriod, string> = {
  week: "금주",
  month: "이번달",
  all: "역대",
};

// 호출 전 페이지가 connection()으로 동적 렌더를 보장한다(prerender Date 오류 회피).
function windowStart(period: RankPeriod): string | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const d = new Date(now);
  const mondayOffset = (d.getDay() + 6) % 7; // 월=0
  d.setDate(d.getDate() - mondayOffset);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export type ArtistRankEntry = {
  rank: number;
  userId: string;
  name: string;
  handle: string | null;
  score: number;
};

export async function artistRanking(period: RankPeriod, limit = 20): Promise<ArtistRankEntry[]> {
  const start = windowStart(period);
  let q = db()
    .from("engagements")
    .select("artwork_id, artworks!inner(artist_id, status)")
    .eq("artworks.status", "active");
  if (start) q = q.gte("created_at", start);
  const { data, error } =
    await q.returns<{ artworks: { artist_id: string | null; status: string } }[]>();
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data) {
    const aid = row.artworks?.artist_id;
    if (aid) counts.set(aid, (counts.get(aid) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (top.length === 0) return [];

  const { data: artists, error: aErr } = await db()
    .from("artists")
    .select("user_id, display_name, handle, status")
    .in(
      "user_id",
      top.map(([id]) => id),
    )
    .returns<{ user_id: string; display_name: string; handle: string; status: string }[]>();
  if (aErr) throw aErr;
  const byId = new Map(artists.map((a) => [a.user_id, a]));

  return top.map(([userId, score], i) => {
    const a = byId.get(userId);
    return {
      rank: i + 1,
      userId,
      name: a?.display_name ?? "작가",
      handle: a?.status === "approved" ? (a?.handle ?? null) : null,
      score,
    };
  });
}

export type ArtworkRankEntry = {
  rank: number;
  artworkId: string;
  title: string;
  artistName: string;
  formatLabel: string;
  cardLabel: string;
  cardPath: string;
  recommends: number;
};

type RecRow = {
  artwork_id: string;
  artworks: {
    title: string | null;
    artist_name: string;
    format: Format;
    status: string;
    cards: { set_code: string; collector_number: string };
  } | null;
};

export async function artworkRanking(period: RankPeriod, limit = 20): Promise<ArtworkRankEntry[]> {
  const start = windowStart(period);
  let q = db()
    .from("engagements")
    .select(
      "artwork_id, artworks!inner(title, artist_name, format, status, cards(set_code, collector_number))",
    )
    .eq("kind", "recommend")
    .eq("artworks.status", "active");
  if (start) q = q.gte("created_at", start);
  const { data, error } = await q.returns<RecRow[]>();
  if (error) throw error;

  const counts = new Map<string, { n: number; row: RecRow["artworks"] }>();
  for (const row of data) {
    if (!row.artworks) continue;
    const cur = counts.get(row.artwork_id);
    if (cur) cur.n += 1;
    else counts.set(row.artwork_id, { n: 1, row: row.artworks });
  }

  return [...counts.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, limit)
    .map(([artworkId, { n, row }], i) => ({
      rank: i + 1,
      artworkId,
      title: row!.title?.trim() || `${row!.artist_name}님의 도안`,
      artistName: row!.artist_name,
      formatLabel: FORMAT_INFO[row!.format].label,
      cardLabel: `${row!.cards.set_code} ${row!.cards.collector_number}`,
      cardPath: `/cards/${encodeURIComponent(row!.cards.set_code)}/${row!.cards.collector_number.replace("/", "-")}`,
      recommends: n,
    }));
}
