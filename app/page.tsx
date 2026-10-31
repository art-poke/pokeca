import { ArrowUpRight, Crown, Sparkles } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArtworkItem } from "@/components/ArtworkItem";
import { HomeBanner } from "@/components/home/home-banner";
import { ArtworkGridSkeleton, RankingListSkeleton } from "@/components/skeletons";
import { recentArtworks } from "@/lib/artworks";
import { artistRanking } from "@/lib/ranking";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="space-y-10 md:space-y-12">
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <HomeBanner />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="recent-heading">
          <div className="flex items-end justify-between">
            <h2
              id="recent-heading"
              className="flex items-center gap-2 font-display text-xl font-bold text-foreground md:text-2xl"
            >
              <Sparkles className="size-5 text-primary" aria-hidden />
              최근 올라온 도안
            </h2>
            <Link
              href="/search"
              className="flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              더 보기
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <Suspense fallback={<ArtworkGridSkeleton className="mt-4" />}>
            <RecentArtworks />
          </Suspense>
        </section>

        <aside aria-labelledby="ranking-heading">
          <div className="rounded-2xl border border-border bg-background p-5">
            <h2 id="ranking-heading" className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <Crown className="size-5 text-primary" aria-hidden />
              주간 작가 랭킹
            </h2>
            <Suspense fallback={<div className="mt-4"><RankingListSkeleton /></div>}>
              <WeeklyRanking />
            </Suspense>
            <Link
              href="/ranking"
              className="mt-3 flex items-center justify-center gap-1 rounded-xl bg-muted py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-gray-200"
            >
              전체 랭킹 보기
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

async function RecentArtworks() {
  await connection();
  const items = await recentArtworks(8);
  if (items.length === 0) {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-border bg-background px-3 py-12 text-center text-sm text-muted-foreground">
        아직 올라온 도안이 없어요. 작가 스튜디오에서 첫 도안을 올려보세요.
      </p>
    );
  }
  return (
    <ul className="mt-4 grid grid-cols-2 gap-3 duration-500 animate-in fade-in slide-in-from-bottom-3 sm:grid-cols-3 md:grid-cols-4">
      {items.map((a) => (
        <ArtworkItem key={a.id} artwork={a} card={a.card} />
      ))}
    </ul>
  );
}

async function WeeklyRanking() {
  await connection();
  const rows = await artistRanking("week", 5);
  if (rows.length === 0) {
    return (
      <p className="mt-4 rounded-xl bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
        이번 주 활동이 아직 없어요.
      </p>
    );
  }
  return (
    <ol className="mt-4 space-y-0.5">
      {rows.map((a) => (
        <li key={a.userId} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-gray-50">
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              a.rank === 1
                ? "bg-primary text-primary-foreground"
                : a.rank === 2
                  ? "bg-ink-700 text-white"
                  : a.rank === 3
                    ? "bg-ink-400 text-white"
                    : "text-muted-foreground",
            )}
          >
            {a.rank}
          </span>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
            {a.name[0]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">{a.name}</div>
            <div className="truncate text-xs text-muted-foreground">{a.score}점</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
