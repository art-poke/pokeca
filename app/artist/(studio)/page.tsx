import { Download, Megaphone, ThumbsUp, Trophy } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArtistReviews } from "@/components/artist-reviews";
import { ArtworkGridSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { artistStats } from "@/lib/artist-stats";
import { anyApprovedArtist, type Artist, currentArtist, currentSocialUser, listMyArtworks } from "@/lib/artists";
import { listArtistReviews } from "@/lib/reviews";
import { StudioArtworks } from "./StudioArtworks";

export const metadata = { title: "내 스튜디오 · 확장 아트 아카이브" };

export default function StudioPage(props: PageProps<"/artist">) {
  return (
    <Suspense fallback={<StudioSkeleton />}>
      <Studio searchParams={props.searchParams} />
    </Suspense>
  );
}

function StudioSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row">
        <Skeleton className="h-56 rounded-2xl sm:w-64 sm:shrink-0" />
        <div className="grid flex-1 grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
      <Skeleton className="h-7 w-40" />
      <ArtworkGridSkeleton count={4} />
    </div>
  );
}

// 로그인한 작가, 없으면 dev에서 데모 작가로 미리보기, 그 외 로그인으로.
async function resolveArtist(): Promise<{ artist: Artist; preview: boolean }> {
  const real = await currentArtist();
  if (real) return { artist: real, preview: false };
  if (process.env.NODE_ENV === "development") {
    const demo = await anyApprovedArtist();
    if (demo) return { artist: demo, preview: true };
  }
  // 로그인했지만 아직 작가가 아니면 신청 폼으로, 로그인조차 안 했으면 로그인으로.
  const user = await currentSocialUser();
  redirect(user ? "/artist/signup" : "/artist/login");
}

async function Studio({ searchParams }: { searchParams: PageProps<"/artist">["searchParams"] }) {
  const { artist, preview } = await resolveArtist();
  const { uploaded } = await searchParams;

  if (artist.status !== "approved") return <StatusCard artist={artist} />;

  const [works, stats, reviews] = await Promise.all([
    listMyArtworks(artist.userId),
    artistStats(artist.userId),
    listArtistReviews(artist.userId, null),
  ]);

  const statCards = [
    { label: "올린 도안", value: works.length, icon: Trophy },
    { label: "받은 추천", value: stats.recommends, icon: ThumbsUp },
    { label: "다운로드", value: stats.downloads, icon: Download },
    { label: "해결한 요청", value: stats.resolved, icon: Megaphone },
  ];

  return (
    <div className="enter space-y-8">
      {preview && (
        <p className="rounded-xl bg-accent px-4 py-2.5 text-sm text-accent-foreground">
          미리보기 모드예요 — 실제로는 로그인한 본인 계정이 보여요. (데모 작가 @{artist.displayName})
        </p>
      )}

      {/* 좌: 프로필(이미지+이름) · 우: 통계 2x2 */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-background p-6 sm:w-64 sm:shrink-0 sm:self-start">
          <span className="flex size-32 items-center justify-center rounded-full bg-secondary text-5xl font-bold text-secondary-foreground ring-4 ring-accent">
            {artist.displayName[0]}
          </span>
          <h1 className="font-display text-xl font-bold text-foreground">@{artist.displayName}</h1>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3">
          {statCards.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4"
            >
              <s.icon className="size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <div className="tabular text-2xl font-bold leading-none text-foreground">
                  {s.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {uploaded && (
        <p role="status" className="rounded-xl bg-success/10 px-4 py-2.5 text-sm font-medium text-success">
          도안을 올렸어요. 카드 페이지와 작가 페이지에 공개됐어요.
        </p>
      )}

      <StudioArtworks works={works} />

      <ArtistReviews
        artistHandle={artist.handle}
        reviews={reviews}
        canWrite={false}
        selfNotice="방문자가 남긴 후기예요. 작가 공개 페이지에도 함께 보여요."
      />
    </div>
  );
}

function StatusCard({ artist }: { artist: Artist }) {
  return (
    <div className="mx-auto max-w-xl space-y-3 rounded-2xl border border-border bg-background p-6 text-center">
      <h1 className="font-display text-xl font-bold text-foreground">@{artist.displayName}</h1>
      {artist.status === "pending" ? (
        <>
          <p className="font-semibold text-foreground">작가 신청을 받았어요.</p>
          <p className="text-sm text-muted-foreground">
            어드민이 본인 확인을 마치면 도안을 올릴 수 있어요. 신청한 작가 페이지: /artists/{artist.handle}
          </p>
        </>
      ) : (
        <>
          <p className="font-semibold text-foreground">지금은 도안을 올릴 수 없어요.</p>
          <p className="text-sm text-muted-foreground">
            어드민이 작가 확인을 마치지 못했어요. 문의는 사이트 푸터의 연락처로 보내 주세요.
          </p>
        </>
      )}
    </div>
  );
}
