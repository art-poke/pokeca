import Link from "next/link";
import { ChevronDown, Trophy } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { gamePlayerId } from "@/lib/game-player";
import { GAMES, isGame, koreaDay, moveMonth, rankingMonth, type Game } from "@/domains/card-fragments/rules";
import { loadRecords } from "@/domains/card-fragments/server";
import { PuzzleBoard } from "@/domains/card-fragments/puzzle-board";

export async function generateMetadata({ params }: PageProps<"/card-fragments/[game]">) {
  const { game } = await params;
  return { title: isGame(game) ? GAMES[game].title : "게임" };
}

export default async function PuzzlePage({ params, searchParams }: PageProps<"/card-fragments/[game]">) {
  const { game } = await params;
  if (!isGame(game)) notFound();
  const userId = await gamePlayerId();
  if (!userId) redirect("/artist/login?source=game_play");

  const day = koreaDay();
  const currentMonth = day.slice(0, 7);
  const query = await searchParams;
  const month = rankingMonth(query.month, day);
  const records = await loadRecords(game, month, userId);
  const recordProps = { game, currentMonth, month, records };

  return (
    <section className="mx-auto max-w-5xl">
      <Link href="/games" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground">
        ← 게임 선택
      </Link>
      <header className="mb-5">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{GAMES[game].title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{GAMES[game].description}</p>
      </header>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(275px,20rem)] lg:gap-6">
        <div className="min-w-0">
          <PuzzleBoard key={game} game={game} />
        </div>
        <aside aria-label="기록과 랭킹" className="hidden min-w-0 lg:block">
          <GameRecords {...recordProps} rankingId="monthly-ranking" />
        </aside>
        <details open={query.month ? true : undefined} className="group rounded-2xl border border-border bg-card lg:hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 p-4 text-sm font-bold [&::-webkit-details-marker]:hidden">
            <Trophy aria-hidden className="size-4 text-primary" />
            기록과 랭킹
            <ChevronDown aria-hidden className="ml-auto size-4 group-open:rotate-180" />
          </summary>
          <div className="px-3 pb-3">
            <GameRecords {...recordProps} rankingId="monthly-ranking-mobile" />
          </div>
        </details>
      </div>
    </section>
  );
}

function GameRecords({ game, currentMonth, month, records, rankingId }: {
  game: Game;
  currentMonth: string;
  month: string;
  records: Awaited<ReturnType<typeof loadRecords>>;
  rankingId: string;
}) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthLink = (offset: number) => `/card-fragments/${game}?month=${moveMonth(month, offset)}#${rankingId}`;
  const monthButton = "grid size-11 place-items-center rounded-xl border border-border font-semibold hover:bg-muted";
  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-bold">내 최고기록</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="col-span-2 rounded-xl bg-muted p-3"><dt>최다 연속 정답</dt><dd className="mt-1 text-xl font-extrabold">{records.bestRun}개</dd></div>
          <div className="rounded-xl bg-muted p-3"><dt>{game === "name" ? "한 달 최다 별" : "월간 한 판 최고점"}</dt><dd className="mt-1 text-xl font-extrabold">{records.bestMonth}개</dd></div>
          <div className="rounded-xl bg-muted p-3"><dt>{game === "name" ? "연속 첫 답 정답" : "연속 정답"}</dt><dd className="mt-1 text-xl font-extrabold">{records.streak}일</dd></div>
        </dl>
      </section>
      <section id={rankingId} className="scroll-mt-16 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">{year}년 {monthNumber}월 랭킹</h2>
          <nav aria-label="랭킹 월 선택" className="flex shrink-0 gap-1">
            {month > "2000-01" && <Link className={monthButton} href={monthLink(-1)} aria-label="이전 달">‹</Link>}
            {month < currentMonth && <Link className={monthButton} href={monthLink(1)} aria-label="다음 달">›</Link>}
          </nav>
        </div>
        {records.ranking.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">이 달에는 정답 기록이 없어요.</p> :
          <ol className="mt-2 divide-y divide-border">
            {records.ranking.map((row, index) => (
              <li key={index} className="flex items-center gap-3 py-3 text-sm">
                <span className="shrink-0 font-bold">{row.rank}위</span>
                <span className="min-w-0 flex-1 truncate" title={row.name}>{row.name}{row.mine ? " (나)" : ""}</span>
                <span className="shrink-0 text-muted-foreground">{game === "name" ? `별 ${row.stars} · 정답 ${row.wins}` : `최고 ${row.wins}개`}</span>
              </li>
            ))}
          </ol>}
      </section>
    </div>
  );
}
