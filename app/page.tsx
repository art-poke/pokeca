import { ArrowUpRight, Crown, Minus, TrendingUp } from "lucide-react";
import Link from "next/link";
import { HomeBanner } from "@/components/home/home-banner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// mock 데이터 (추후 실제 집계로 교체). 주간 작가 랭킹 · 이달의 소식.
const WEEKLY_ARTISTS = [
  { rank: 1, name: "별빛도안", handle: "byeolbit", works: 23, downloads: "1.2k", trend: "up" },
  { rank: 2, name: "새벽작업실", handle: "dawn", works: 19, downloads: "980", trend: "up" },
  { rank: 3, name: "불꽃공방", handle: "flame", works: 15, downloads: "840", trend: "same" },
  { rank: 4, name: "리자몽러버", handle: "charlover", works: 12, downloads: "610", trend: "up" },
  { rank: 5, name: "포켓아트", handle: "pocketart", works: 9, downloads: "420", trend: "same" },
] as const;

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
      {/* 애니메이션 배너 캐러셀 */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <HomeBanner />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* 이달의 소식 */}
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

        {/* 주간 작가 랭킹 */}
        <aside aria-labelledby="ranking-heading">
          <div className="rounded-2xl border border-border bg-background p-5">
            <h2 id="ranking-heading" className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <Crown className="size-5 text-primary" aria-hidden />
              주간 작가 랭킹
            </h2>
            <ol className="mt-4 space-y-0.5">
              {WEEKLY_ARTISTS.map((a, i) => (
                <li
                  key={a.handle}
                  className="flex animate-in items-center gap-3 rounded-xl px-2 py-2 fade-in slide-in-from-bottom-2 fill-mode-both duration-500 hover:bg-gray-50"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <RankNum rank={a.rank} />
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
                    {a.name[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">{a.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      도안 {a.works} · 다운로드 {a.downloads}
                    </div>
                  </div>
                  <Trend trend={a.trend} />
                </li>
              ))}
            </ol>
            <Link
              href="/search"
              className="mt-3 flex items-center justify-center gap-1 rounded-xl bg-muted py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-gray-200"
            >
              전체 작가 보기
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

const RankNum = ({ rank }: { rank: number }) => (
  <span
    className={cn(
      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
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

const Trend = ({ trend }: { trend: "up" | "same" }) =>
  trend === "up" ? (
    <TrendingUp className="size-4 shrink-0 text-primary" aria-label="상승" />
  ) : (
    <Minus className="size-4 shrink-0 text-gray-300" aria-label="유지" />
  );
