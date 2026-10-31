import { Download, Megaphone, Plus, ThumbsUp, Trophy } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { artistStats } from "@/lib/artist-stats";
import { listOpenRequests } from "@/lib/art-requests";
import { anyApprovedArtist, type Artist, currentArtist, listMyArtworks } from "@/lib/artists";
import { FORMAT_INFO, type Format } from "@/lib/formats";
import { WithdrawMine } from "./WithdrawMine";

export const metadata = { title: "내 스튜디오 · 확장 아트 아카이브" };

const STATUS = {
  active: { label: "공개", variant: "soft" as const },
  hidden: { label: "숨김(검토중)", variant: "muted" as const },
  withdrawn: { label: "내림", variant: "muted" as const },
};

export default function StudioPage(props: PageProps<"/artist">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-gray-100" />}>
      <Studio searchParams={props.searchParams} />
    </Suspense>
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
  redirect("/artist/login");
}

async function Studio({ searchParams }: { searchParams: PageProps<"/artist">["searchParams"] }) {
  const { artist, preview } = await resolveArtist();
  const { uploaded } = await searchParams;

  if (artist.status !== "approved") return <StatusCard artist={artist} />;

  const [works, stats, requests] = await Promise.all([
    listMyArtworks(artist.userId),
    artistStats(artist.userId),
    listOpenRequests(5),
  ]);

  const statCards = [
    { label: "올린 도안", value: works.length, icon: Trophy },
    { label: "받은 추천", value: stats.recommends, icon: ThumbsUp },
    { label: "다운로드", value: stats.downloads, icon: Download },
    { label: "해결한 요청", value: stats.resolved, icon: Megaphone },
  ];

  return (
    <div className="space-y-8">
      {preview && (
        <p className="rounded-xl bg-accent px-4 py-2.5 text-sm text-accent-foreground">
          미리보기 모드예요 — 실제로는 로그인한 본인 계정이 보여요. (데모 작가 @{artist.displayName})
        </p>
      )}

      {/* 프로필 헤더 */}
      <header className="flex items-center gap-4 rounded-2xl border border-border bg-background p-5 md:p-6">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-xl font-bold text-secondary-foreground">
          {artist.displayName[0]}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-foreground">@{artist.displayName}</h1>
          <Link href={`/artists/${artist.handle}`} className="text-sm text-muted-foreground hover:text-primary">
            내 작가 페이지 보기 ↗
          </Link>
        </div>
        <Link
          href="/artist/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-red-700"
        >
          <Plus className="size-4" />
          새 도안 올리기
        </Link>
      </header>

      {uploaded && (
        <p role="status" className="rounded-xl bg-success/10 px-4 py-2.5 text-sm font-medium text-success">
          도안을 올렸어요. 카드 페이지와 작가 페이지에 공개됐어요.
        </p>
      )}

      {/* 통계 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-background p-4">
            <s.icon className="size-5 text-primary" aria-hidden />
            <div className="tabular mt-2 text-2xl font-bold text-foreground">{s.value}</div>
            <div className="text-sm text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 내 도안 */}
      <section aria-labelledby="mine" className="space-y-4">
        <h2 id="mine" className="font-display text-xl font-bold text-foreground">
          내 도안 {works.length}개
        </h2>
        {works.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center">
            <p className="text-sm text-muted-foreground">아직 올린 도안이 없어요.</p>
            <Link
              href="/artist/new"
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-red-700"
            >
              <Plus className="size-4" /> 첫 도안 올리기
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {works.map((a) => (
              <li
                key={a.id}
                className="overflow-hidden rounded-2xl border border-border bg-background"
              >
                <Link href={`/artworks/${a.id}`} className="block">
                  <div className="aspect-[63/88] w-full bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/thumbnails/${a.id}`}
                      alt={a.title}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  </div>
                </Link>
                <div className="space-y-1.5 p-3">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={STATUS[a.status].variant}>{STATUS[a.status].label}</Badge>
                    <Badge variant="muted">{FORMAT_INFO[a.format as Format]?.label ?? a.format}</Badge>
                  </div>
                  <p className="truncate text-sm font-semibold text-foreground">{a.title}</p>
                  <p className="tabular truncate text-xs text-muted-foreground">{a.card.label}</p>
                  {a.status !== "withdrawn" && <WithdrawMine id={a.id} cardLabel={a.card.label} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 들어온 요청(그려주세요) */}
      {requests.length > 0 && (
        <section aria-labelledby="incoming" className="space-y-4">
          <h2 id="incoming" className="font-display text-xl font-bold text-foreground">
            그려주세요 — 많이 요청된 도안
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
            {requests.map((r) => (
              <li key={`${r.cardPath}-${r.format}`}>
                <Link
                  href={r.cardPath}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="tabular font-semibold text-foreground">{r.cardLabel}</span>
                      <Badge variant="secondary">{r.formatLabel}</Badge>
                    </div>
                    <div className="truncate text-sm text-muted-foreground">{r.name}</div>
                  </div>
                  <Badge variant="primary">요청 {r.count}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
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
