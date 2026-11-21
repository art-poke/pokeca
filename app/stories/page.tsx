import { BookOpen, Gavel, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { RowsSkeleton } from "@/components/skeletons";
import { StoryCard } from "@/components/story-card";
import { StoryFeed } from "@/components/story-feed";
import { isStoryCategory, storyCategoryLabels, type StoryFilter } from "@/domains/story/types";
import { getStoryIndex } from "@/lib/story-feed";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "카드 이야기 · Extended Art Archive",
  description: "카드 한 장에 무슨 일이 있었길래? 프로모 뒷이야기, 눈이 번쩍 뜨이는 낙찰가, 새 카드 소식.",
};

const tabs = [
  { id: "all", label: "전체" },
  { id: "promo", label: storyCategoryLabels.promo, icon: BookOpen },
  { id: "auction", label: storyCategoryLabels.auction, icon: Gavel },
  { id: "release", label: storyCategoryLabels.release, icon: Sparkles },
] as const;

async function StoryIndex({ category }: { category: StoryFilter }) {
  const { featured, feed } = await getStoryIndex(category);
  if (!featured) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center sm:p-12">
        <p className="font-display text-lg font-bold">아직 이 칸은 비어 있어요.</p>
        <Link href="/stories" className="mt-2 inline-block text-sm font-semibold text-blue-700 underline underline-offset-4">
          전체 이야기 구경하기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <section aria-labelledby="featured-story" className="space-y-3">
        <h2 id="featured-story" className="flex items-center gap-2 font-display text-lg font-bold">
          <span aria-hidden className="size-2.5 rounded-full bg-blue-500" />
          가장 많이 읽은 이야기
        </h2>
        <StoryCard story={featured} featured />
      </section>
      <section aria-labelledby="latest-stories" className="space-y-3">
        <h2 id="latest-stories" className="font-display text-lg font-bold">최근 이야기</h2>
        <StoryFeed category={category} featuredSlug={featured.slug} initial={feed} />
      </section>
    </div>
  );
}

export default async function StoriesPage({ searchParams }: PageProps<"/stories">) {
  const { category: rawCategory } = await searchParams;
  const category = isStoryCategory(rawCategory) ? rawCategory : "all";

  return (
    <div className="mx-auto max-w-5xl space-y-5 text-slate-900 sm:space-y-6">
      <header className="overflow-hidden rounded-[1.6rem] border border-blue-100 bg-[#eef4ff] px-5 pt-6 sm:px-8 sm:pt-7">
        <div className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-4 pr-2 sm:grid-cols-[minmax(0,1fr)_6rem] sm:gap-8 sm:pr-5">
          <div>
            <h1 className="font-display text-4xl leading-none font-bold tracking-tight break-keep sm:text-6xl">카드 이야기</h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed break-keep text-slate-600 sm:text-base">
              카드 한 장에 무슨 일이 있었길래? 모으다가 궁금해진 얘기를 하나씩 낋여옵니다.
            </p>
          </div>
          <Image
            src="/stories/pokemon-card-back.webp"
            width={360}
            height={492}
            alt=""
            unoptimized
            className="h-auto w-full rotate-[12deg] rounded-[5%] shadow-[3px_6px_14px_#1e3a5f44] sm:rotate-[15deg]"
          />
        </div>
        <nav aria-label="카드 이야기 카테고리" className="mt-6 flex flex-wrap gap-1.5 border-t border-blue-200 py-3 sm:gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.id === "all" ? "/stories" : `/stories?category=${tab.id}`}
              aria-current={category === tab.id ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm",
                category === tab.id
                  ? "bg-blue-800 text-white"
                  : "bg-white text-slate-700 hover:bg-blue-100",
              )}
            >
              {"icon" in tab && <tab.icon className="size-4" aria-hidden />}
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>
      <Suspense key={category} fallback={<RowsSkeleton count={3} />}>
        <StoryIndex category={category} />
      </Suspense>
    </div>
  );
}
