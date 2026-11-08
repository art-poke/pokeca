"use client";

import { useEffect, useRef } from "react";
import type { ArtworkFeedPage } from "@/domains/artwork/api/types";
import { useRecentArtworksInfinite } from "@/domains/artwork/hooks";
import { ArtworkCard } from "./artwork-card";

// "최근 올라온 도안" 전체 목록 + 무한스크롤. 1페이지는 서버가 준 initial로 즉시 그리고,
// 바닥 센티넬이 뷰포트에 가까워지면 다음 페이지를 당긴다.
export const RecentArtworksInfinite = ({ initial }: { initial: ArtworkFeedPage }) => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useRecentArtworksInfinite(initial);
  const sentinel = useRef<HTMLDivElement>(null);
  const artworks = data?.pages.flatMap((p) => p.artworks) ?? initial.artworks;

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

  if (artworks.length === 0) {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-border bg-background px-3 py-16 text-center text-sm text-muted-foreground">
        아직 올라온 도안이 없어요.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {artworks.map((a) => (
          <ArtworkCard key={a.id} artwork={a} />
        ))}
      </div>
      <div ref={sentinel} aria-hidden className="h-8" />
      {isFetchingNextPage && (
        <p className="mt-4 text-center text-sm text-muted-foreground">불러오는 중…</p>
      )}
    </>
  );
};
