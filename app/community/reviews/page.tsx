import Link from "next/link";
import { Suspense } from "react";
import { CommunityTabs } from "@/components/community-tabs";
import { ReviewArtistSearch } from "@/components/review-artist-search";
import { RowsSkeleton } from "@/components/skeletons";
import { recentReviews } from "@/lib/reviews";

export const metadata = { title: "작가 후기 · 커뮤니티 · 확장 아트 아카이브" };

export default function ReviewsPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">커뮤니티</h1>
      </header>

      <CommunityTabs active="reviews" />

      <p className="text-sm text-muted-foreground">
        작가님 도안을 써 본 후기를 남겨요. 후기는 작가 페이지와 스튜디오에도 함께 보여요.
      </p>

      <ReviewArtistSearch />

      <section aria-labelledby="recent-reviews" className="space-y-3">
        <h2 id="recent-reviews" className="font-display text-lg font-bold text-foreground">
          최근 후기
        </h2>
        <Suspense fallback={<RowsSkeleton count={4} />}>
          <Feed />
        </Suspense>
      </section>
    </div>
  );
}

async function Feed() {
  const reviews = await recentReviews(15);
  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
        아직 후기가 없어요. 위에서 작가를 찾아 첫 후기를 남겨보세요.
      </div>
    );
  }
  return (
    <ul className="enter space-y-3">
      {reviews.map((r) => (
        <li key={r.id} className="rounded-2xl border border-border bg-background p-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-foreground">{r.authorName}</span>
            <span className="text-muted-foreground">→</span>
            <Link href={`/artists/${r.artistHandle}`} className="font-semibold text-primary hover:underline">
              {r.artistName}
            </Link>
            <span className="tabular ml-auto text-xs text-muted-foreground">
              {new Date(r.createdAt).toLocaleDateString("ko-KR")}
            </span>
          </div>
          <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-ink-700">{r.body}</p>
          {r.hasImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/reviews/${r.id}/image`}
              alt="후기 이미지"
              loading="lazy"
              className="mt-3 max-h-56 rounded-xl border border-border object-contain"
            />
          )}
        </li>
      ))}
    </ul>
  );
}
