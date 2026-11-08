"use client";

import { useEffect, useRef } from "react";
import { CardTile } from "@/components/card-tile";
import type { CardSearchPage } from "@/domains/card-search/api/types";
import { useCardSearchInfinite } from "@/domains/card-search/hooks";

// 검색 결과 격자 + 무한스크롤. 1페이지는 서버가 준 initial로 즉시 그리고,
// 바닥 센티넬이 뷰포트에 가까워지면 다음 페이지를 당긴다.
export function SearchResults({ query, initial }: { query: string; initial: CardSearchPage }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useCardSearchInfinite(
    query,
    initial,
  );
  const sentinel = useRef<HTMLDivElement>(null);
  const hits = data?.pages.flatMap((p) => p.hits) ?? initial.hits;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <>
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
        카드 {hits.length}
        {hasNextPage ? "+" : ""}장
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {hits.map((hit) => (
          <li key={hit.cardId}>
            <CardTile
              card={{
                setCode: hit.setCode,
                collectorNumber: hit.collectorNumber,
                nameKo: hit.nameKo,
                imagePath: hit.imagePath,
                artworkCount: hit.artworkCount,
                rarity: hit.rarity,
                lang: hit.lang,
              }}
            />
          </li>
        ))}
      </ul>
      <div ref={sentinel} aria-hidden className="h-8" />
      {isFetchingNextPage && (
        <p className="mt-4 text-center text-sm text-muted-foreground">불러오는 중…</p>
      )}
    </>
  );
}
