import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { gameScores, users } from "@/lib/db/schema";

// 몬스터볼 수박게임 서버 로직(읽기/쓰기). 서버컴포넌트/서버액션/route가 직접 호출.
//   리더보드: 역대(all) = 유저별 MAX(score), 월별(month) = played_at이 이번 달.

export type LeaderboardScope = "all" | "month";

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  image: string | null;
  score: number;
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
  const windowed = start ? gte(gameScores.playedAt, start) : undefined;
  const best = sql<number>`max(${gameScores.score})::int`;

  const rows = await db
    .select({
      userId: gameScores.userId,
      name: users.name,
      image: users.image,
      best,
    })
    .from(gameScores)
    .innerJoin(users, eq(users.id, gameScores.userId))
    .where(windowed)
    .groupBy(gameScores.userId, users.name, users.image)
    .orderBy(desc(best))
    .limit(limit);

  const entries: LeaderboardEntry[] = rows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    name: r.name?.trim() || "플레이어",
    image: r.image ?? null,
    score: Number(r.best),
  }));

  let me: LeaderboardResult["me"] = null;
  if (opts.userId) {
    const [meRow] = await db
      .select({ best })
      .from(gameScores)
      .where(and(eq(gameScores.userId, opts.userId), windowed));
    const meBest = meRow?.best;
    if (meBest != null) {
      // 내 최고점보다 높은 유저 수 + 1 = 내 순위.
      const higher = await db.execute(
        sql`select count(*)::int as n from (
              select user_id, max(score) as b from ${gameScores}
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
