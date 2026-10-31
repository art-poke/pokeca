import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArtistGallery } from "@/components/ArtistGallery";
import { resolvedCountByArtist } from "@/lib/art-requests";
import { getPortfolio } from "@/lib/artists";
import { safeDecode } from "@/lib/search";

export async function generateMetadata(props: PageProps<"/artists/[handle]">): Promise<Metadata> {
  const { handle } = await props.params;
  return { title: `@${safeDecode(handle) ?? handle} · 확장 아트 아카이브` };
}

export default function ArtistPage(props: PageProps<"/artists/[handle]">) {
  return (
    <Suspense>
      <Portfolio params={props.params} />
    </Suspense>
  );
}

async function Portfolio({ params }: Pick<PageProps<"/artists/[handle]">, "params">) {
  const handle = safeDecode((await params).handle);
  const found = handle ? await getPortfolio(handle) : null;
  if (!found) notFound();
  const { artist, artworks } = found;
  const resolved = await resolvedCountByArtist(artist.userId);

  return (
    <article className="mx-auto max-w-5xl space-y-8">
      <header className="flex items-start gap-4 rounded-2xl border border-border bg-background p-5 md:gap-5 md:p-6">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-secondary-foreground">
          {artist.displayName[0]}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-foreground">@{artist.displayName}</h1>
          {artist.intro && <p className="mt-1 text-sm text-muted-foreground">{artist.intro}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <span className="text-ink-700">
              <strong className="tabular font-bold text-foreground">{artworks.length}</strong> 도안
            </span>
            <span className="text-ink-700">
              <strong className="tabular font-bold text-primary">{resolved}</strong> 해결한 요청
            </span>
          </div>
          {artist.linkUrl && (
            <p className="mt-2 text-sm">
              <a
                href={artist.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-ink-600 underline-offset-2 hover:text-primary hover:underline"
              >
                작가가 작품을 올리는 곳 ↗<span className="visually-hidden">(새 탭)</span>
              </a>
            </p>
          )}
        </div>
      </header>

      <section aria-labelledby="gallery-heading">
        <h2 id="gallery-heading" className="font-display text-xl font-bold text-foreground">
          확장 아트 도안 {artworks.length}개
        </h2>
        <div className="mt-4">
          {artworks.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
              아직 공개한 도안이 없어요.
            </p>
          ) : (
            <ArtistGallery artworks={artworks} />
          )}
        </div>
      </section>
    </article>
  );
}
