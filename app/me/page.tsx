import { Download, Megaphone, Star, ThumbsUp, Trophy } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArtistReviews } from "@/components/artist-reviews";
import { ProfileEdit } from "@/components/profile-edit";
import { RowsSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { anyMember, currentArtist, listMyArtworks, type Artist } from "@/lib/artists";
import { artistStats } from "@/lib/artist-stats";
import { listFavoriteCards } from "@/lib/favorites";
import { listArtistReviews } from "@/lib/reviews";
import { StudioArtworks } from "@/app/artist/(studio)/StudioArtworks";

export const metadata = { title: "마이페이지 · Extended Art Archive" };

export default function MyProfilePage(props: PageProps<"/me">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-8">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-6 w-40" />
          <RowsSkeleton count={4} />
        </div>
      }
    >
      <Profile searchParams={props.searchParams} />
    </Suspense>
  );
}

// 로그인한 프로필, 없으면 dev에서 데모 프로필로 미리보기, 그 외 로그인으로.
async function resolveProfile(): Promise<{ profile: Artist; preview: boolean }> {
  const real = await currentArtist();
  if (real) return { profile: real, preview: false };
  if (process.env.NODE_ENV === "development") {
    const demo = await anyMember();
    if (demo) return { profile: demo, preview: true };
  }
  redirect("/artist/login");
}

async function Profile({ searchParams }: { searchParams: PageProps<"/me">["searchParams"] }) {
  const { profile, preview } = await resolveProfile();
  const { setup, uploaded } = await searchParams;

  const [favorites, works, stats] = await Promise.all([
    listFavoriteCards(profile.userId),
    listMyArtworks(profile.userId),
    artistStats(profile.userId),
  ]);
  const reviews = profile.handle ? await listArtistReviews(profile.userId, null) : [];

  const statCards = [
    { label: "올린 도안", value: works.length, icon: Trophy },
    { label: "받은 추천", value: stats.recommends, icon: ThumbsUp },
    { label: "다운로드", value: stats.downloads, icon: Download },
    { label: "해결한 요청", value: stats.resolved, icon: Megaphone },
  ];

  return (
    <div className="enter space-y-8">
      <ProfileEdit
        userId={profile.userId}
        displayName={profile.displayName}
        handle={profile.handle}
        hasAvatar={!!profile.avatarPath}
        preview={preview}
        setupHandle={setup === "handle"}
      />

      {uploaded && (
        <p role="status" className="rounded-xl bg-success/10 px-4 py-2.5 text-sm font-medium text-success">
          도안을 올렸어요. 카드 페이지와 작가 페이지에 공개됐어요.
        </p>
      )}

      {/* 통계 2x2 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4">
            <s.icon className="size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <div className="tabular text-2xl font-bold leading-none text-foreground">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <StudioArtworks works={works} />

      <section aria-labelledby="favs" className="space-y-4">
        <div className="flex items-center gap-2">
          <Star className="size-5 text-amber-400" aria-hidden />
          <h2 id="favs" className="font-display text-xl font-bold text-foreground">
            즐겨찾기한 카드 {favorites.length}개
          </h2>
        </div>

        {favorites.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
            아직 즐겨찾기한 카드가 없어요. 카드 페이지에서 <span className="font-semibold text-foreground">즐겨찾기</span>를 눌러 담아 보세요.
          </div>
        ) : (
          <ul className="enter grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((c) => (
              <li key={c.cardId}>
                <Link
                  href={c.path}
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-background p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-gradient-to-br from-gray-50 to-gray-200 text-center">
                    <span className="tabular text-[11px] font-bold leading-tight text-ink-600">
                      {c.label.split(" ")[1] ?? c.label}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{c.name}</p>
                    <p className="tabular truncate text-xs text-muted-foreground">
                      {c.label} · {c.setName}
                    </p>
                    <div className="mt-1.5">
                      <Badge variant={c.artworkCount > 0 ? "soft" : "muted"}>도안 {c.artworkCount}개</Badge>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {profile.handle && (
        <ArtistReviews
          artistHandle={profile.handle}
          reviews={reviews}
          canWrite={false}
          selfNotice="방문자가 남긴 후기예요. 작가 공개 페이지에도 함께 보여요."
        />
      )}
    </div>
  );
}
