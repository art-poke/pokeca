import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArtistName, DownloadAction, SourceLink } from "@/components/ArtworkItem";
import { Comments } from "@/components/comments";
import { RecommendButton } from "@/components/recommend-button";
import { ReportTrigger } from "@/components/report-trigger";
import { Badge } from "@/components/ui/badge";
import { getArtworkDetail } from "@/lib/artworks";
import { listComments } from "@/lib/comments";
import { getEngagement } from "@/lib/engagements";
import { FORMAT_INFO } from "@/lib/formats";
import { currentMember } from "@/lib/members";

export default function ArtworkPage(props: PageProps<"/artworks/[id]">) {
  return (
    <Suspense>
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

  return (
    <article className="mx-auto max-w-5xl space-y-8">
      <Link
        href={artwork.card.path}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        <span className="tabular font-medium">{artwork.card.label}</span>
        {artwork.card.name}
      </Link>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex items-center justify-center overflow-hidden rounded-2xl border border-border bg-ink-900 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/thumbnails/${id}`}
            alt={`${artwork.title} (@${artwork.artistName})`}
            className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain"
          />
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
