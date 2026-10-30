import { ArrowUpRight, Crown } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { HomeBanner } from "@/components/home/home-banner";
import { Badge } from "@/components/ui/badge";
import { artistRanking } from "@/lib/ranking";
import { cn } from "@/lib/utils";

// 이달의 소식은 아직 mock (뉴스 시스템은 추후). 주간 작가 랭킹은 실제 engagements 집계.
const NEWS = [
  {
    tag: "공지",
    title: "한글판 카드 1,430장 데이터 반영",
    date: "2026.10.30",
    excerpt: "스칼렛&바이올렛·MEGA 시리즈 47개 세트의 확장 아트 카드를 검색할 수 있어요.",
  },
  {
    tag: "업데이트",
    title: "PSA·BRG 인쇄 치수 안내 추가",
    date: "2026.10.22",
    excerpt: "다운로드 후 슬랩 보관 케이스에 맞는 정확한 인쇄 크기를 알려드려요.",
  },
  {
    tag: "이벤트",
    title: "이달의 9포켓 바인더 챌린지",
    date: "2026.10.15",
    excerpt: "좋아하는 포켓몬으로 9포켓을 채우고 작가님께 응원을 남겨보세요.",
  },
] as const;

export default function Home() {
  return (
    <div className="space-y-10 md:space-y-12">
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <HomeBanner />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="news-heading">
          <div className="flex items-end justify-between">
            <h2 id="news-heading" className="font-display text-xl font-bold text-foreground md:text-2xl">
              이달의 소식
            </h2>
            <span className="text-sm text-muted-foreground">총 {NEWS.length}건</span>
          </div>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {NEWS.map((n, i) => (
              <li
                key={n.title}
                className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <article className="group h-full rounded-2xl border border-border bg-background p-5 transition-shadow hover:shadow-md">
                  <Badge variant={n.tag === "공지" ? "primary" : "soft"}>{n.tag}</Badge>
                  <h3 className="mt-3 font-bold text-foreground transition-colors group-hover:text-primary">
                    {n.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{n.excerpt}</p>
                  <time className="mt-4 block text-xs text-muted-foreground">{n.date}</time>
                </article>
              </li>
            ))}
          </ul>
        </section>

        <aside aria-labelledby="ranking-heading">
          <div className="rounded-2xl border border-border bg-background p-5">
            <h2 id="ranking-heading" className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <Crown className="size-5 text-primary" aria-hidden />
              주간 작가 랭킹
            </h2>
            <Suspense
              fallback={<div className="mt-4 h-40 animate-pulse rounded-xl bg-gray-100" />}
            >
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
