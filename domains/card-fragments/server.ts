import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { longestStreak, type Game } from "./rules";

export async function loadRecords(game: Game, month: string, userId: string) {
  const monthStart = month + "-01";
  const [ranking, history] = await Promise.all([
    db.execute<{ rank: number; name: string; stars: number; wins: number; mine: boolean }>(sql`
      with totals as (
        select user_id, sum(wins)::int wins, sum(stars)::int stars
        from (
          select user_id, 1 as wins, (guesses = 1 and not used_hint)::int as stars
          from card_fragment_attempts
          where game = ${game} and day >= ${monthStart} and day < ${monthStart}::date + interval '1 month' and solved
          union all
          select user_id, wins, stars from card_fragment_run_scores
          where game = ${game} and day >= ${monthStart} and day < ${monthStart}::date + interval '1 month' and wins > 0
        ) scores group by user_id
      ), ranked as (
        select *, rank() over (order by case when ${game} = 'name' then stars else 0 end desc, wins desc)::int rank
        from totals
      )
      select r.rank, coalesce(nullif(btrim(a.display_name), ''), nullif(btrim(u.name), ''), '플레이어') name,
        r.wins, r.stars, r.user_id = ${userId} as mine
      from ranked r join users u on u.id = r.user_id left join artists a on a.user_id = r.user_id
      where r.rank <= 10 or r.user_id = ${userId}
      order by r.rank, r.user_id
    `),
    db.execute<{ day: string; wins: number; stars: number }>(sql`
      select day::text, count(*)::int as wins, count(*) filter (where guesses = 1 and not used_hint)::int as stars
      from card_fragment_attempts where game = ${game} and user_id = ${userId} and solved group by day
      union all
      select day::text, wins, stars from card_fragment_run_scores
      where game = ${game} and user_id = ${userId} and wins > 0
    `),
  ]);
  const days = new Set<string>();
  const monthly = new Map<string, number>();
  let bestRun = 0;
  let bestMonth = 0;
  for (const { day, wins, stars } of history.rows) {
    bestRun = Math.max(bestRun, wins);
    const points = game === "name" ? stars : wins;
    if (points === 0) continue;
    days.add(day);
    const month = day.slice(0, 7);
    const total = (monthly.get(month) ?? 0) + points;
    monthly.set(month, total);
    bestMonth = Math.max(bestMonth, total);
  }
  return { ranking: ranking.rows, bestMonth, bestRun, streak: longestStreak([...days].sort()) };
}
