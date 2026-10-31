import type {
  Artwork,
  ArtworkDetail,
  ArtworksData,
  ServerArtworkCard,
  ServerArtworkDetail,
  ServerArtworkItem,
  ServerArtworksResponse,
} from "./api/types";

// ---------------------------------------------------------------------------
// Server → Client 변환. 순수함수(React/네트워크 의존 없음) — 테스트하기 쉽다.
// 필드 리네임·중첩 평탄화·파생값(카드 경로, 출처 도메인) 계산을 여기 모은다.
// ---------------------------------------------------------------------------

const toCard = (c: ServerArtworkCard) => ({
  label: `${c.setCode} ${c.collectorNumber}`,
  path: `/cards/${encodeURIComponent(c.setCode)}/${c.collectorNumber.replace("/", "-")}`,
  name: c.nameKo,
});

const toSourceDomain = (sourceUrl: string | null): string | null => {
  if (!sourceUrl) return null;
  try {
    return new URL(sourceUrl).hostname;
  } catch {
    return null;
  }
};

export const ArtworkTransformer = {
  toArtwork(item: ServerArtworkItem): Artwork {
    return {
      id: item.artworkId,
      title: item.title?.trim() || `${item.artistName}님의 도안`,
      artistName: item.artistName,
      artistHandle: item.artistHandle,
      format: item.format,
      card: toCard(item.card),
      thumbnailUrl: item.thumbnailUrl,
      membersOnly: item.membersOnly,
      printSizeVerified: item.printSizeVerified,
      recommendCount: item.stats.recommendCount,
      isRecommended: item.me.isRecommended,
      createdAt: item.createdAt,
    };
  },

  toDetail(item: ServerArtworkDetail): ArtworkDetail {
    return {
      ...this.toArtwork(item),
      sourceUrl: item.sourceUrl,
      sourceDomain: toSourceDomain(item.sourceUrl),
      pieceCount: item.pieceCount,
      positions: item.positions,
    };
  },

  toArtworksData(res: ServerArtworksResponse): ArtworksData {
    return {
      items: res.items.map((i) => this.toArtwork(i)),
      nextCursor: res.nextCursor,
      hasNext: res.hasNext,
    };
  },
};
