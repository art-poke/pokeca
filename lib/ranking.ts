import "server-only";
import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { artists, artworks, cards, engagements } from "@/lib/db/schema";
import { FORMAT_INFO, type Format } from "@/lib/formats";

// 랭킹 (engagements 집계). 금주(월요일 시작)·이번달·역대.
//   작가 랭킹 = 자기 active 도안들의 engagement(다운로드+추천) 수 + 기간 내 올린 도안 수(업로드 점수).
//   도안 랭킹 = 추천 수.
// 초기엔 JS 집계(데이터 적음). 규모 커지면 집계 뷰/테이블로 최적화.

// 도안 1개 올리면 engagement 1건과 같은 점수. 올리기만 해도 랭킹에 기여한다(가중치 조절 지점).
const UPLOAD_POINTS = 1;

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
  const rows = await db
    .select({ artistId: artworks.artistId })
    .from(engagements)
    .innerJoin(artworks, eq(engagements.artworkId, artworks.id))
    .where(
      and(
        eq(artworks.status, "active"),
        start ? gte(engagements.createdAt, new Date(start)) : undefined,
      ),
    );

  const counts = new Map<string, number>();
  for (const row of rows) {
    const aid = row.artistId;
    if (aid) counts.set(aid, (counts.get(aid) ?? 0) + 1);
  }

  // 업로드 점수: 기간 내 올린 active 도안 1개당 UPLOAD_POINTS. engagement이 없는 작가도 랭킹에 오른다.
  const uploads = await db
    .select({ artistId: artworks.artistId })
    .from(artworks)
    .where(
      and(
        eq(artworks.status, "active"),
        start ? gte(artworks.createdAt, new Date(start)) : undefined,
      ),
    );
  for (const row of uploads) {
    const aid = row.artistId;
    if (aid) counts.set(aid, (counts.get(aid) ?? 0) + UPLOAD_POINTS);
  }

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (top.length === 0) return [];

  const artistRows = await db
    .select({
      user_id: artists.userId,
      display_name: artists.displayName,
      handle: artists.handle,
    })
    .from(artists)
    .where(
      inArray(
        artists.userId,
        top.map(([id]) => id),
      ),
    );
  const byId = new Map(artistRows.map((a) => [a.user_id, a]));

  return top.map(([userId, score], i) => {
    const a = byId.get(userId);
    return {
      rank: i + 1,
      userId,
      name: a?.display_name ?? "작가",
      handle: a?.handle ?? null,
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
  const rows = await db
    .select({
      artwork_id: engagements.artworkId,
      title: artworks.title,
      artist_name: artworks.artistName,
      format: artworks.format,
      status: artworks.status,
      set_code: cards.setCode,
      collector_number: cards.collectorNumber,
    })
    .from(engagements)
    .innerJoin(artworks, eq(engagements.artworkId, artworks.id))
    .innerJoin(cards, eq(artworks.cardId, cards.id))
    .where(
      and(
        eq(engagements.kind, "recommend"),
        eq(artworks.status, "active"),
        start ? gte(engagements.createdAt, new Date(start)) : undefined,
      ),
    );

  const counts = new Map<string, { n: number; row: NonNullable<RecRow["artworks"]> }>();
  for (const row of rows) {
    const cur = counts.get(row.artwork_id);
    if (cur) cur.n += 1;
    else
      counts.set(row.artwork_id, {
        n: 1,
        row: {
          title: row.title,
          artist_name: row.artist_name,
          format: row.format as Format,
          status: row.status,
          cards: { set_code: row.set_code, collector_number: row.collector_number },
        },
      });
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
