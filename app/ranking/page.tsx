import { Crown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  artistRanking,
  artworkRanking,
  PERIOD_LABEL,
  RANK_PERIODS,
  type RankPeriod,
} from "@/lib/ranking";

export const metadata = { title: "랭킹 · 확장 아트 아카이브" };

type Kind = "artist" | "artwork";

export default function RankingPage(props: PageProps<"/ranking">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-gray-100" />}>
      <Ranking searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Ranking({ searchParams }: Pick<PageProps<"/ranking">, "searchParams">) {
  await connection();
  const sp = await searchParams;
  const rawPeriod = Array.isArray(sp.period) ? sp.period[0] : sp.period;
  const period: RankPeriod = RANK_PERIODS.includes(rawPeriod as RankPeriod)
    ? (rawPeriod as RankPeriod)
    : "week";
  const rawKind = Array.isArray(sp.kind) ? sp.kind[0] : sp.kind;
  const kind: Kind = rawKind === "artwork" ? "artwork" : "artist";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center gap-2">
        <Crown className="size-7 text-primary" aria-hidden />
        <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">랭킹</h1>
      </header>

      {/* 작가 / 도안 */}
      <div className="inline-flex rounded-xl bg-muted p-1">
        {(["artist", "artwork"] as Kind[]).map((k) => (
          <Link
            key={k}
            href={`/ranking?kind=${k}&period=${period}`}
            aria-current={kind === k}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
              kind === k
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k === "artist" ? "작가 랭킹" : "도안 랭킹"}
          </Link>
        ))}
      </div>

      {/* 금주 / 이번달 / 역대 */}
      <div className="flex gap-2">
        {RANK_PERIODS.map((p) => (
          <Link
            key={p}
            href={`/ranking?kind=${kind}&period=${p}`}
            aria-current={period === p}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              period === p
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border text-ink-700 hover:border-gray-300",
            )}
          >
            {PERIOD_LABEL[p]}
          </Link>
        ))}
      </div>

      {kind === "artist" ? <ArtistBoard period={period} /> : <ArtworkBoard period={period} />}
    </div>
  );
}

const RankNum = ({ rank }: { rank: number }) => (
  <span
    className={cn(
      "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
      rank === 1
        ? "bg-primary text-primary-foreground"
        : rank === 2
          ? "bg-ink-700 text-white"
          : rank === 3
            ? "bg-ink-400 text-white"
            : "text-muted-foreground",
    )}
  >
    {rank}
  </span>
);

const EmptyBoard = () => (
  <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
    아직 집계된 활동이 없어요. 도안을 추천하거나 다운로드하면 랭킹이 쌓여요.
  </div>
);

async function ArtistBoard({ period }: { period: RankPeriod }) {
  const rows = await artistRanking(period);
  if (rows.length === 0) return <EmptyBoard />;
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
      {rows.map((a) => (
        <li key={a.userId} className="flex items-center gap-3 px-4 py-3">
          <RankNum rank={a.rank} />
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
            {a.name[0]}
          </span>
          <div className="min-w-0 flex-1">
            {a.handle ? (
              <Link href={`/artists/${a.handle}`} className="font-semibold text-foreground hover:text-primary">
                {a.name}
              </Link>
            ) : (
              <span className="font-semibold text-foreground">{a.name}</span>
            )}
          </div>
          <span className="tabular text-sm font-semibold text-ink-600">{a.score}점</span>
        </li>
      ))}
    </ol>
  );
}

async function ArtworkBoard({ period }: { period: RankPeriod }) {
  const rows = await artworkRanking(period);
  if (rows.length === 0) return <EmptyBoard />;
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
      {rows.map((a) => (
        <li key={a.artworkId} className="flex items-center gap-3 px-4 py-3">
          <RankNum rank={a.rank} />
          <div className="min-w-0 flex-1">
            <Link
              href={`/artworks/${a.artworkId}`}
              className="block truncate font-semibold text-foreground hover:text-primary"
            >
              {a.title}
            </Link>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>@{a.artistName}</span>
              <Badge variant="muted">{a.formatLabel}</Badge>
              <Link href={a.cardPath} className="tabular hover:text-primary">
                {a.cardLabel}
              </Link>
            </div>
          </div>
          <span className="flex items-center gap-1 text-sm font-semibold text-primary">
            <TrendingUp className="size-4" aria-hidden />
            {a.recommends}
          </span>
        </li>
      ))}
    </ol>
  );
}
