"use client";

import { useEffect, useMemo, useRef } from "react";
import { useArtworksQuery } from "@/domains/artwork/hooks";
import { ArtworkCard } from "./artwork-card";

// 목록 클라이언트. 서버가 1페이지를 prefetch→hydrate 해두고, 여기서 이어받아 무한스크롤.
export const ArtworkListClient = ({ cardId }: { cardId?: string }) => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isError, refetch } =
    useArtworksQuery(cardId);

  const items = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 화면이 멈추지 않도록 에러도 인라인으로 복구 UI를 준다(전역 바운더리로 안 던짐).
  if (isError) {
    return (
      <div className="py-12 text-center text-sm text-ink-500">
        목록을 불러오지 못했어요.
        <button
          type="button"
          onClick={() => refetch()}
          className="ml-2 font-semibold text-foreground underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="py-12 text-center text-sm text-ink-500">아직 도안이 없어요.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((a) => (
          <ArtworkCard key={a.id} artwork={a} />
        ))}
      </div>
      <div ref={sentinel} aria-hidden className="h-8" />
      {isFetchingNextPage && (
        <p className="py-4 text-center text-xs text-ink-400">불러오는 중…</p>
      )}
    </>
  );
};
