"use client";

import { useRecentArtworksQuery } from "@/domains/artwork/hooks";
import { ArtworkCard } from "./artwork-card";

// 홈 최신 도안 목록. 서버가 prefetch→hydrate 해두고 여기서 이어받는다.
// 에러도 인라인 복구 UI로(전역 바운더리로 안 던짐 → 화면 안 멈춤).
export const ArtworkListClient = ({ limit }: { limit?: number }) => {
  const { data: artworks, isError, refetch } = useRecentArtworksQuery(limit);

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

  if (!artworks || artworks.length === 0) {
    return <p className="py-12 text-center text-sm text-ink-500">아직 도안이 없어요.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {artworks.map((a) => (
        <ArtworkCard key={a.id} artwork={a} />
      ))}
    </div>
  );
};
