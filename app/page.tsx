import { ArrowUpRight, BookOpen, Crown, Gamepad2, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { cache, Suspense } from "react";
import { stories } from "@/app/stories/stories";
import { ArtworkItem } from "@/components/ArtworkItem";
import { HomeBanner } from "@/components/home/home-banner";
import { GameTeaserBall } from "@/components/home/game-teaser-ball";
import { ArtworkGridSkeleton, RankingListSkeleton } from "@/components/skeletons";
import { BallBadge } from "@/domains/game/components/ball-badge";
import { storyCategoryLabels } from "@/domains/story/types";
import { getArtworkDetail, recentArtworks } from "@/lib/artworks";
import { cardImageUrl } from "@/lib/card-image";
import { artistRanking } from "@/lib/ranking";
import { cn } from "@/lib/utils";

const getRecentArtworks = cache(() => recentArtworks(8));
const latestStories = stories.slice(-3).reverse();

export default function Home() {
  return (
    <div className="space-y-10 md:space-y-12">
      <h1 className="sr-only">확장 아트 아카이브</h1>
      <Suspense fallback={<div className="min-h-[23rem] animate-pulse rounded-3xl bg-[#10192c] md:min-h-[17.5rem] motion-reduce:animate-none" aria-hidden="true" />}>
        <FeaturedArtwork />
      </Suspense>

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
              href="/artworks"
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

        <aside aria-labelledby="ranking-heading" className="space-y-4">
          <section aria-labelledby="ranking-heading" className="rounded-2xl border border-border bg-background p-5">
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
          </section>
          <Link href="/play" className="group block overflow-hidden rounded-2xl border border-red-200 bg-red-50 text-slate-900 hover:border-red-400">
            <div aria-hidden="true" className="relative grid h-34 place-items-center overflow-hidden bg-linear-to-br from-[#ff4d45] via-[#ee1515] to-[#a80918]">
              <div className="w-44 rounded-xl border border-white/30 bg-[#be121c] p-1.5 shadow-[0_8px_20px_#69000c99]">
                <div className="flex items-center justify-between rounded-t-md bg-zinc-950 px-2 py-1 text-[9px] font-bold tracking-wider text-white">
                  <span>MONSTER BALL DROP</span>
                  <span className="font-mono text-amber-300">+10</span>
                </div>
                <div className="relative h-[5.25rem] overflow-hidden rounded-b-md border border-zinc-700 bg-[#171627] shadow-inner">
                  <span className="absolute inset-x-2 top-5 border-t border-dashed border-red-400/50" />
                  <span className="absolute top-2 bottom-3 left-1/2 border-l border-dashed border-white/25" />
                  <span className="absolute bottom-1 left-2 -rotate-12"><BallBadge tier={2} size={30} /></span>
                  <span className="absolute bottom-0 left-10 rotate-12"><BallBadge tier={11} size={40} /></span>
                  <span className="absolute right-2 bottom-1 -rotate-12"><BallBadge tier={9} size={35} /></span>
                  <span className="absolute bottom-0 left-[5.5rem] rotate-12"><BallBadge tier={3} size={23} /></span>
                  <GameTeaserBall />
                </div>
              </div>
            </div>
            <div className="p-4">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <Gamepad2 className="size-5 text-red-700" aria-hidden />
                몬스터볼 게임
              </h2>
              <p className="mt-1 text-sm break-keep text-slate-600">같은 볼을 합쳐서 마스터볼까지!</p>
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-red-700 px-3 py-1.5 text-xs font-bold text-white group-hover:bg-red-800">
                게임 하러 가기 <ArrowUpRight className="size-3.5" aria-hidden />
              </span>
            </div>
          </Link>
        </aside>
      </div>
      <section aria-labelledby="home-stories-heading" className="space-y-5 rounded-3xl border border-blue-100 bg-[#eff5ff] p-4 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="home-stories-heading" className="flex items-center gap-2 font-display text-2xl font-bold text-slate-950 sm:text-3xl">
            <BookOpen className="size-6 text-blue-700" aria-hidden />
            카드 이야기
          </h2>
          <Link href="/stories" className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100">
            전체 이야기 보기 <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
        <ul className="grid gap-4 md:grid-cols-3">
          {latestStories.map((story) => (
            <li key={story.slug}>
              <Link href={`/stories/${story.slug}`} prefetch={false} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white hover:border-blue-400">
                <div className="relative aspect-[120/63] overflow-hidden bg-blue-100">
                  <Image src={story.shareImage.url} alt="" fill unoptimized sizes="(min-width: 768px) 33vw, 100vw" className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.03]" />
                </div>
                <div className="space-y-2 p-4">
                  <p className="text-xs font-bold text-blue-800">{storyCategoryLabels[story.category]}</p>
                  <h3 className="font-display text-lg leading-snug font-bold break-keep text-slate-950">{story.title}</h3>
                  <p className="text-sm leading-relaxed break-keep text-slate-600">{story.summary}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

async function FeaturedArtwork() {
  await connection();
  const items = await getRecentArtworks();
  const item = items.find(({ card }) => card.imagePath);
  const latestStory = latestStories[0];
  const story = { slug: latestStory.slug, title: latestStory.title, image: latestStory.shareImage.url };
  if (!item?.card.imagePath) return <HomeBanner story={story} />;

  const isBinder = item.format === "9pocket" || item.format === "9pocket_tl";
  const detail = isBinder ? await getArtworkDetail(item.id) : null;
  return (
    <HomeBanner story={story} example={{
      id: item.id,
      artistName: item.artistName,
      cardName: item.card.name,
      cardImage: cardImageUrl(item.card.imagePath, item.card.lang),
      positions: detail?.positions ?? [],
    }} />
  );
}

async function RecentArtworks() {
  await connection();
  const items = await getRecentArtworks();
  if (items.length === 0) {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-border bg-background px-3 py-12 text-center text-sm text-muted-foreground">
        아직 올라온 도안이 없어요. 마이페이지에서 주소 이름을 정하고 첫 도안을 올려보세요.
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
