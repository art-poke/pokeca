import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CardImageZoom } from "@/components/card-image-zoom";
import { FavoriteButton } from "@/components/favorite-button";
import { FormatResults } from "@/components/FormatResults";
import { RequestArtButton } from "@/components/request-art-button";
import { Badge } from "@/components/ui/badge";
import { PokeballMark } from "@/components/ui/logo";
import { requestedFormats } from "@/lib/art-requests";
import { listPublicArtworks } from "@/lib/artworks";
import { getCard } from "@/lib/cards";
import { CardPageSkeleton } from "@/components/skeletons";
import { isFavorited } from "@/lib/favorites";
import { FORMATS } from "@/lib/formats";
import { currentMember } from "@/lib/artists";
import { numberFromPath, safeDecode } from "@/lib/search";

const LANG_LABEL = { ja: "일본", en: "영문" } as const;

export default function CardPage(props: PageProps<"/cards/[set]/[number]">) {
  return (
    <Suspense fallback={<CardPageSkeleton />}>
      <Card params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Card({
  params,
  searchParams,
}: Pick<PageProps<"/cards/[set]/[number]">, "params" | "searchParams">) {
  const { set, number } = await params;
  const setCode = safeDecode(set);
  const collectorNumber = numberFromPath(number);
  if (setCode === null || collectorNumber === null) notFound();
  const card = await getCard(setCode, collectorNumber);
  if (!card) notFound();

  const [artworks, query, member] = await Promise.all([
    listPublicArtworks(card.cardId),
    searchParams,
    currentMember(),
  ]);
  const from = aliasFrom(query.from);
  const [myRequested, favorited] = member
    ? await Promise.all([requestedFormats(member.userId, card.cardId), isFavorited(member.userId, card.cardId)])
    : [[], false];
  const present = new Set(artworks.map((a) => a.format));
  const missingFormats = FORMATS.filter((f) => !present.has(f));

  return (
    <article className="enter space-y-8">
      <header className="flex items-stretch gap-4 rounded-2xl border border-border bg-background p-4 md:gap-6 md:p-6">
        {/* 공식 카드 이미지(수집한 카드만). 모바일에서도 보인다(작게). 없으면 중립 실루엣(sm 이상에서만). */}
        {card.imagePath ? (
          <CardImageZoom
            src={`/api/card-images/${card.imagePath.replace(/^cards\//, "")}`}
            alt={`${card.nameKo} 카드`}
          />
        ) : (
          <div
            className="relative hidden aspect-[63/88] w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-gradient-to-br from-gray-50 to-gray-200 sm:flex md:w-32"
            aria-hidden
          >
            <PokeballMark className="absolute -bottom-4 -right-4 size-20 opacity-[0.1]" />
            <span className="tabular px-2 text-center text-sm font-bold leading-snug text-ink-600">
              {card.setCode}
              <br />
              {card.collectorNumber}
            </span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="tabular font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl md:text-4xl">
            {card.setCode} {card.collectorNumber}
          </h1>
          <p className="mt-1 text-lg font-semibold text-foreground md:text-xl">{card.nameKo}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {card.rarity && <Badge variant="outline">{card.rarity}</Badge>}
            <span>{card.setName}</span>
            {card.illustrator && (
              <>
                <span aria-hidden className="text-gray-300">
                  ·
                </span>
                <span>일러스트 {card.illustrator}</span>
              </>
            )}
          </div>
          {from && (
            <p className="mt-3 rounded-xl bg-accent px-3.5 py-2.5 text-sm text-accent-foreground">
              입력한 <span className="tabular font-semibold">{from.number}</span>(
              {LANG_LABEL[from.lang]}판)과 같은 그림의 한글판 카드예요. 도안은 한글판 기준이에요.
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <FavoriteButton cardId={card.cardId} isMember={!!member} initial={favorited} />
            <RequestArtButton
              cardId={card.cardId}
              isMember={!!member}
              missingFormats={missingFormats}
              requestedFormats={myRequested}
            />
          </div>
        </div>
      </header>

      <FormatResults cardId={card.cardId} artworks={artworks} />
    </article>
  );
}

function aliasFrom(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const m = raw?.match(/^(ja|en):([^:]+):(.+)$/);
  return m ? { lang: m[1] as "ja" | "en", setCode: m[2], number: `${m[2]} ${m[3]}` } : null;
}
