import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FormatResults } from "@/components/FormatResults";
import { Badge } from "@/components/ui/badge";
import { PokeballMark } from "@/components/ui/logo";
import { listPublicArtworks } from "@/lib/artworks";
import { getCard } from "@/lib/cards";
import { numberFromPath, safeDecode } from "@/lib/search";

const LANG_LABEL = { ja: "일본", en: "영문" } as const;

export default function CardPage(props: PageProps<"/cards/[set]/[number]">) {
  return (
    <Suspense>
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

  const [artworks, query] = await Promise.all([listPublicArtworks(card.cardId), searchParams]);
  const from = aliasFrom(query.from);

  return (
    <article className="space-y-8">
      <header className="flex items-stretch gap-4 rounded-2xl border border-border bg-background p-4 md:gap-6 md:p-6">
        {/* 공식 카드 이미지는 쓰지 않는다. 중립 실루엣만 둔다. */}
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
        <div className="min-w-0 flex-1">
          <h1 className="tabular font-display text-2xl font-bold tracking-tight text-foreground md:text-4xl">
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
