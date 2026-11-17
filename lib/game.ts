import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { gameScores } from "@/lib/db/schema";

// 몬스터볼 수박게임 서버 로직(읽기/쓰기). 서버컴포넌트/서버액션/route가 직접 호출.
//   리더보드: 역대(all) = 유저별 MAX(score), 월별(month) = played_at이 이번 달.

export type LeaderboardScope = "all" | "month";

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  image: string | null;
  score: number;
  comment: string | null; // 최고기록에 남긴 한줄평
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
  const res = await db.execute(sql`
    select t.user_id, t.score::int as score, t.comment, u.name, u.image
    from (
      select distinct on (gs.user_id) gs.user_id, gs.score, gs.comment, gs.played_at
      from game_scores gs
      ${start ? sql`where gs.played_at >= ${start}` : sql``}
      order by gs.user_id, gs.score desc, gs.played_at desc
    ) t
    join users u on u.id = t.user_id
    order by t.score desc, t.played_at asc
    limit ${limit}
  `);

  type Row = { user_id: string; score: number; comment: string | null; name: string | null; image: string | null };
  const entries: LeaderboardEntry[] = (res.rows as Row[]).map((r, i) => ({
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
      // 내 최고점보다 높은 유저 수 + 1 = 내 순위.
      const higher = await db.execute(
        sql`select count(*)::int as n from (
              select user_id, max(score) as b from game_scores
              ${start ? sql`where played_at >= ${start}` : sql``}
              group by user_id having max(score) > ${meBest}
            ) t`,
      );
      const n = Number((higher.rows?.[0] as { n?: number } | undefined)?.n ?? 0);
      me = { rank: n + 1, score: Number(meBest) };
    }
  }

  return { entries, me };
};
