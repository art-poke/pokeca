import { Crown, Medal, TrendingUp, Trophy } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { RankingListSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  artistRanking,
  type ArtistRankEntry,
  artworkRanking,
  PERIOD_LABEL,
  RANK_PERIODS,
  type RankPeriod,
} from "@/lib/ranking";
import { cn } from "@/lib/utils";

export const metadata = { title: "랭킹 · Extended Art Archive" };

export default function RankingPage(props: PageProps<"/ranking">) {
  return (
    <Suspense fallback={<RankingSkeleton />}>
      <Ranking searchParams={props.searchParams} />
    </Suspense>
  );
}

function RankingSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-10 w-64 rounded-xl" />
      <Skeleton className="h-64 rounded-3xl" />
      <RankingListSkeleton count={6} />
    </div>
  );
}

async function Ranking({ searchParams }: Pick<PageProps<"/ranking">, "searchParams">) {
  await connection();
  const sp = await searchParams;
  const raw = Array.isArray(sp.period) ? sp.period[0] : sp.period;
  const period: RankPeriod = RANK_PERIODS.includes(raw as RankPeriod) ? (raw as RankPeriod) : "week";

  const [artists, artworks] = await Promise.all([artistRanking(period, 10), artworkRanking(period, 6)]);

  return (
    <div className="enter space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="size-7 text-primary" aria-hidden />
          <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">랭킹</h1>
        </div>
        <div className="flex gap-2">
          {RANK_PERIODS.map((p) => (
            <Link
              key={p}
              href={`/ranking?period=${p}`}
              aria-current={period === p}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                period === p
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-ink-700 hover:border-gray-300",
              )}
            >
              {PERIOD_LABEL[p]}
            </Link>
          ))}
        </div>
      </header>

      {/* 작가 시상대 */}
      <section aria-labelledby="artist-rank" className="space-y-4">
        <h2 id="artist-rank" className="font-display text-xl font-bold text-foreground">
          {PERIOD_LABEL[period]} 작가 시상대
        </h2>
        {artists.length === 0 ? (
          <Empty />
        ) : (
          <>
            <Podium top={artists.slice(0, 3)} />
            {artists.length > 3 && (
              <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
                {artists.slice(3).map((a) => (
                  <li key={a.userId} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-6 text-center text-sm font-bold text-muted-foreground">
                      {a.rank}
                    </span>
                    <Avatar name={a.name} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <NameLink a={a} className="font-semibold text-foreground hover:text-primary" />
                    </div>
                    <span className="tabular text-sm font-semibold text-ink-600">{a.score}점</span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </section>

      {/* 인기 도안 */}
      <section aria-labelledby="art-rank" className="space-y-4">
        <h2 id="art-rank" className="font-display text-xl font-bold text-foreground">
          {PERIOD_LABEL[period]} 인기 도안
        </h2>
        {artworks.length === 0 ? (
          <Empty />
        ) : (
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {artworks.map((a) => (
              <li key={a.artworkId} className="min-w-0">
                <Link
                  href={`/artworks/${a.artworkId}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3.5 transition-shadow hover:shadow-md"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      a.rank === 1
                        ? "bg-primary text-primary-foreground"
                        : a.rank <= 3
                          ? "bg-ink-700 text-white"
                          : "bg-muted text-ink-600",
                    )}
                  >
                    {a.rank}
                  </span>
                  {/* 실제 확장 아트 썸네일 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/thumbnails/${a.artworkId}`}
                    alt={a.title}
                    loading="lazy"
                    className="size-14 shrink-0 rounded-lg border border-border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-foreground">{a.title}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="truncate">@{a.artistName}</span>
                      <Badge variant="muted">{a.formatLabel}</Badge>
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
                    <TrendingUp className="size-4" aria-hidden />
                    {a.recommends}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

const Empty = () => (
  <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
    아직 집계된 활동이 없어요. 도안을 추천하거나 다운로드하면 랭킹이 쌓여요.
  </div>
);

const Avatar = ({ name, className }: { name: string; className?: string }) => (
  <span
    className={cn(
      "flex shrink-0 items-center justify-center rounded-full bg-secondary font-bold text-secondary-foreground",
      className,
    )}
  >
    {name[0]}
  </span>
);

const NameLink = ({ a, className }: { a: ArtistRankEntry; className?: string }) =>
  a.handle ? (
    <Link href={`/artists/${a.handle}`} className={cn("block truncate", className)}>
      {a.name}
    </Link>
  ) : (
    <span className={cn("block truncate", className)}>{a.name}</span>
  );

// 시상대: 2위-1위-3위 배치, 1위가 가장 높고 크다.
const Podium = ({ top }: { top: ArtistRankEntry[] }) => {
  const first = top[0];
  const second = top[1];
  const third = top[2];
  const slots = [
    { a: second, place: 2, pedestal: "h-20", avatar: "size-16", ring: "ring-ink-400" },
    { a: first, place: 1, pedestal: "h-28", avatar: "size-24", ring: "ring-primary" },
    { a: third, place: 3, pedestal: "h-14", avatar: "size-16", ring: "ring-ink-300" },
  ];
  return (
    <div className="rounded-3xl border border-border bg-gradient-to-b from-accent to-background p-5 md:p-8">
      <div className="flex items-end justify-center gap-3 sm:gap-6">
        {slots.map(({ a, place, pedestal, avatar, ring }) =>
          a ? (
            <div key={place} className="flex w-24 flex-col items-center sm:w-28">
              {place === 1 && <Crown className="mb-1 size-6 text-primary" aria-hidden />}
              <div className="relative">
                <Avatar name={a.name} className={cn(avatar, "text-xl ring-4", ring)} />
                <span
                  className={cn(
                    "absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border-2 border-background text-xs font-bold text-white",
                    place === 1 ? "bg-primary" : place === 2 ? "bg-ink-500" : "bg-ink-400",
                  )}
                >
                  {place}
                </span>
              </div>
              <NameLink
                a={a}
                className="mt-2 max-w-full text-center text-sm font-bold text-foreground hover:text-primary"
              />
              <span className="tabular text-xs text-muted-foreground">{a.score}점</span>
              <div
                className={cn(
                  "mt-2 flex w-full items-start justify-center rounded-t-2xl pt-2",
                  pedestal,
                  place === 1 ? "bg-primary/15" : "bg-ink-900/8",
                )}
              >
                <Medal
                  className={cn(
                    "size-5",
                    place === 1 ? "text-primary" : place === 2 ? "text-ink-500" : "text-ink-400",
                  )}
                  aria-hidden
                />
              </div>
            </div>
          ) : (
            <div key={place} className="w-24 sm:w-28" />
          ),
        )}
      </div>
    </div>
  );
};
