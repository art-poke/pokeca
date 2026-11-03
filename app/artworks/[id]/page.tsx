import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArtistName, DownloadAction, SourceLink } from "@/components/ArtworkItem";
import { Comments } from "@/components/comments";
import { RecommendButton } from "@/components/recommend-button";
import { ReportTrigger } from "@/components/report-trigger";
import { ArtworkDetailSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { getArtworkDetail } from "@/lib/artworks";
import { listComments } from "@/lib/comments";
import { getEngagement } from "@/lib/engagements";
import { FORMAT_INFO } from "@/lib/formats";
import { currentMember } from "@/lib/artists";

export default function ArtworkPage(props: PageProps<"/artworks/[id]">) {
  return (
    <Suspense fallback={<ArtworkDetailSkeleton />}>
      <Detail params={props.params} />
    </Suspense>
  );
}

async function Detail({ params }: Pick<PageProps<"/artworks/[id]">, "params">) {
  const { id } = await params;
  const artwork = await getArtworkDetail(id);
  if (!artwork) notFound();

  const member = await currentMember();
  const [engagement, comments] = await Promise.all([
    member ? getEngagement(member.userId, id) : Promise.resolve(null),
    listComments("artwork", id, member?.userId ?? null),
  ]);
  const label = FORMAT_INFO[artwork.format].label;
  const multi = artwork.pieceCount > 1;

  return (
    <article className="enter space-y-8">
      <Link
        href={artwork.card.path}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        <span className="tabular font-medium">{artwork.card.label}</span>
        {artwork.card.name}
      </Link>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-2">
          <div className="flex items-center justify-center overflow-hidden rounded-2xl border border-border bg-ink-900 p-4">
            {multi ? (
              <Assembled id={id} positions={artwork.positions} nine={artwork.format === "9pocket"} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/thumbnails/${id}`}
                alt={`${artwork.title} (@${artwork.artistName})`}
                className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain"
              />
            )}
          </div>
          {multi && (
            <p className="text-center text-xs text-muted-foreground">
              {artwork.format === "9pocket"
                ? `가운데 칸에 실제 카드를 넣고, 둘레 8칸에 조각 ${artwork.pieceCount}장을 끼워요. 다운로드하면 ZIP으로 받아요.`
                : `조각 ${artwork.pieceCount}장 · 다운로드하면 ZIP으로 받아요.`}
            </p>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <Badge variant="muted">{label}</Badge>
            <h1 className="mt-2 font-display text-2xl font-bold text-foreground">{artwork.title}</h1>
            <p className="mt-1.5 text-sm">
              <ArtistName artwork={artwork} />
            </p>
          </div>

          <p className="text-sm text-muted-foreground">{FORMAT_INFO[artwork.format].printSize}</p>
          <SourceLink artwork={artwork} />

          <div className="space-y-2.5">
            <DownloadAction artwork={artwork} />
            <RecommendButton
              artworkId={id}
              initialState={engagement}
              initialCount={artwork.recommendCount}
              isMember={!!member}
            />
          </div>

          <div className="border-t border-border pt-3">
            <ReportTrigger artwork={artwork} />
          </div>
        </div>
      </div>

      <Comments target="artwork" targetId={id} comments={comments} canWrite={!!member} />
    </article>
  );
}

// 여러 조각 조립 미리보기. 9포켓은 3×3(가운데=실제 카드 자리), 그 외는 조각 격자.
// positions = 실제로 조각이 들어간 자리(9포켓 0~7, 빈칸은 빠짐).
function Assembled({ id, positions, nine }: { id: string; positions: number[]; nine: boolean }) {
  const has = new Set(positions);
  if (nine) {
    // 셀 0..8, 가운데(4)는 실제 카드 자리. 둘레 8칸 = 조각 자리 0..7(좌→우, 위→아래).
    return (
      <div className="grid w-full max-w-md grid-cols-3 gap-1.5">
        {Array.from({ length: 9 }, (_, c) => {
          if (c === 4) {
            return (
              <div
                key="center"
                className="flex aspect-[63/88] items-center justify-center rounded-md bg-ink-800 p-1 text-center text-[10px] font-medium leading-tight text-white/55"
              >
                실제 카드 자리
              </div>
            );
          }
          const pi = c < 4 ? c : c - 1;
          return (
            <div key={c} className="relative aspect-[63/88] overflow-hidden rounded-md bg-ink-800/60">
              {has.has(pi) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/thumbnails/${id}?i=${pi}`} alt={`조각 ${pi + 1}`} className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center text-sm font-semibold text-white/20">
                  {pi + 1}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="grid w-full max-w-md grid-cols-3 gap-1.5">
      {positions.map((pi) => (
        <div key={pi} className="relative aspect-[63/88] overflow-hidden rounded-md bg-ink-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/thumbnails/${id}?i=${pi}`} alt={`조각 ${pi + 1}`} className="size-full object-cover" />
        </div>
      ))}
    </div>
  );
}
