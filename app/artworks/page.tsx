import { connection } from "next/server";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { ArtworkGridSkeleton } from "@/components/skeletons";
import { RecentArtworksInfinite } from "@/domains/artwork/components/recent-artworks-infinite";
import { recentArtworksPage } from "@/lib/artworks";

export const metadata = { title: "최근 올라온 도안 · Extended Art Archive" };

// "최근 올라온 도안 더 보기" — 홈의 더 보기에서 넘어온다. 전체 도안을 최신순 무한스크롤.
export default function RecentArtworksRoute() {
  return (
    <div>
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-foreground md:text-3xl">
        <Sparkles className="size-6 text-primary" aria-hidden />
        최근 올라온 도안
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">최근에 올라온 확장 아트 도안을 최신순으로 모아 봐요.</p>
      <Suspense fallback={<ArtworkGridSkeleton className="mt-6" count={12} />}>
        <Feed />
      </Suspense>
    </div>
  );
}

async function Feed() {
  await connection(); // 요청 스코프 보장(프리렌더 Date 오류 회피)
  const initial = await recentArtworksPage({ limit: 20, offset: 0 });
  return (
    <div className="mt-6">
      <RecentArtworksInfinite initial={initial} />
    </div>
  );
}
