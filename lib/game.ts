import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { gameScores } from "@/lib/db/schema";

// 몬스터볼 수박게임 서버 로직(읽기/쓰기). 서버컴포넌트/서버액션/route가 직접 호출.
//   리더보드: 역대(all) = 유저별 MAX(score), 월별(month) = played_at이 이번 달.

export type LeaderboardScope = "all" | "month";

export type LeaderboardEntry = {
  id: string; // game_scores 행 id(판 단위, React key)
  rank: number;
  userId: string;
  name: string;
  image: string | null;
  score: number;
  comment: string | null; // 그 판에 남긴 한줄평
};

export type LeaderboardResult = {
  entries: LeaderboardEntry[];
  me: { rank: number; score: number } | null;
};

export type ScoreInput = {
  score: number;
  ballsPlaced: number;
  maxTier: number;
  durationMs: number;
  comment?: string | null;
};

const monthStart = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

export const insertGameScore = async (userId: string, input: ScoreInput): Promise<string> => {
  const [row] = await db
    .insert(gameScores)
    .values({
      userId,
      score: input.score,
      ballsPlaced: input.ballsPlaced,
      maxTier: input.maxTier,
      durationMs: input.durationMs,
      comment: input.comment?.trim() || null,
    })
    .returning({ id: gameScores.id });
  return row.id;
};

// 최근 windowMs 동안 이 유저의 제출 건수(빈도 제한용).
export const countRecentSubmissions = async (userId: string, windowMs: number): Promise<number> => {
  const since = new Date(Date.now() - windowMs);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(gameScores)
    .where(and(eq(gameScores.userId, userId), gte(gameScores.createdAt, since)));
  return row?.n ?? 0;
};

export const getLeaderboard = async (
  scope: LeaderboardScope,
  opts: { limit?: number; userId?: string | null } = {},
): Promise<LeaderboardResult> => {
  const limit = opts.limit ?? 100;
  const start = scope === "month" ? monthStart() : null;

  // 유저별 '최고 점수 행'(distinct on)을 골라 그 행의 한줄평까지 함께 가져온다.
  // 매 판(모든 game_scores 행)을 다 보여준다 — 같은 사람도 여러 번 등장. 점수순.
  // 닉네임은 artists.display_name이 정본(없으면 users.name). 둘 다 없으면 JS에서 '플레이어' 폴백.
  const res = await db.execute(sql`
    select gs.id, gs.user_id, gs.score::int as score, gs.comment,
           coalesce(nullif(btrim(a.display_name), ''), nullif(btrim(u.name), '')) as name,
           u.image
    from game_scores gs
    join users u on u.id = gs.user_id
    left join artists a on a.user_id = gs.user_id
    ${start ? sql`where gs.played_at >= ${start}` : sql``}
    order by gs.score desc, gs.played_at asc
    limit ${limit}
  `);

  type Row = { id: string; user_id: string; score: number; comment: string | null; name: string | null; image: string | null };
  const entries: LeaderboardEntry[] = (res.rows as Row[]).map((r, i) => ({
    id: r.id,
    rank: i + 1,
    userId: r.user_id,
    name: r.name?.trim() || "플레이어",
    image: r.image ?? null,
    score: Number(r.score),
    comment: r.comment ?? null,
  }));

  let me: LeaderboardResult["me"] = null;
  if (opts.userId) {
    const meRes = await db.execute(
      sql`select max(score)::int as best from game_scores
          where user_id = ${opts.userId} ${start ? sql`and played_at >= ${start}` : sql``}`,
    );
    const meBest = (meRes.rows?.[0] as { best: number | null } | undefined)?.best;
    if (meBest != null) {
      // 모든 판 중 내 최고점보다 높은 '판' 수 + 1 = 내 최고기록의 순위.
      const higher = await db.execute(
        sql`select count(*)::int as n from game_scores
            where score > ${meBest} ${start ? sql`and played_at >= ${start}` : sql``}`,
      );
      const n = Number((higher.rows?.[0] as { n?: number } | undefined)?.n ?? 0);
      me = { rank: n + 1, score: Number(meBest) };
    }
  }

  return { entries, me };
};
