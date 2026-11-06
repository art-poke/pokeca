import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PokeballMark } from "@/components/ui/logo";
import { cardImageUrl } from "@/lib/card-image";
import { cardPath } from "@/lib/search";

export type CardTileData = {
  setCode: string;
  collectorNumber: string;
  nameKo: string;
  imagePath: string | null;
  artworkCount?: number;
  rarity?: string | null;
  lang?: "ko" | "ja";
};

// 검색 랜딩 "둘러보기", 검색 결과 격자, 오타 제안이 공유하는 카드 타일.
// 그림 있으면 실제 카드 이미지, 없으면 중립 실루엣. 모바일 2열부터 데스크톱 4열까지 쓰인다.
export function CardTile({ card }: { card: CardTileData }) {
  const { setCode, collectorNumber, nameKo, imagePath, artworkCount, rarity, lang } = card;
  return (
    <Link
      href={cardPath(setCode, collectorNumber)}
      className="group flex flex-col gap-2 rounded-2xl border border-border bg-background p-2 transition-shadow hover:shadow-md active:scale-[0.99] sm:gap-2.5 sm:p-2.5"
    >
      <div className="relative aspect-[63/88] overflow-hidden rounded-xl border border-border bg-gradient-to-br from-gray-50 to-gray-200">
        {imagePath ? (
          // next/image는 image Lambda가 서명 URL 302를 못 따라가 못 쓴다. 원본이 webp라 최적화 이득도 없다.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cardImageUrl(imagePath, lang)}
            alt={`${nameKo} 카드`}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center" aria-hidden>
            <PokeballMark className="pointer-events-none absolute -bottom-4 -right-4 size-20 opacity-[0.1]" />
            <span className="tabular text-center text-sm font-bold leading-snug text-ink-600">
              {setCode}
              <br />
              {collectorNumber}
            </span>
          </div>
        )}
        {typeof artworkCount === "number" && artworkCount > 0 && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground shadow-sm">
            도안 {artworkCount}
          </span>
        )}
        {lang === "ja" && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-ink-700/85 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
            JP
          </span>
        )}
      </div>
      <div className="min-w-0 px-0.5 pb-0.5">
        <div className="flex items-center gap-1.5">
          <span className="tabular truncate text-xs font-bold text-ink-600 sm:text-sm">
            {setCode} {collectorNumber}
          </span>
          {rarity && <Badge variant="outline">{rarity}</Badge>}
        </div>
        <div className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
          {nameKo}
        </div>
      </div>
    </Link>
  );
}

// 타일 격자 로딩 뼈대.
export function CardTileGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="rounded-2xl border border-border bg-background p-2 sm:p-2.5">
          <div className="aspect-[63/88] animate-pulse rounded-xl bg-gray-100" />
          <div className="mt-2 h-3.5 w-16 animate-pulse rounded bg-gray-100" />
          <div className="mt-1.5 h-4 w-20 animate-pulse rounded bg-gray-100" />
        </li>
      ))}
    </ul>
  );
}
