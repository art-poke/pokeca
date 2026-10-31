"use server";

import { cache } from "react";
import { serverApi } from "@/lib/api/server-fetch";
import { withErrorHandling } from "@/lib/server-action/with-error-handling";
import { ArtworkTransformer } from "@/domains/artwork/transform";
import { ARTWORK_ENDPOINTS } from "./endpoints";
import type {
  ArtworkCursor,
  ArtworkDetail,
  ArtworksData,
  ServerArtworkDetail,
  ServerArtworksResponse,
  ServerRecommendResult,
} from "./types";

// ── 읽기(쿼리용) ─ 실패 시 throw → react-query가 로딩/에러 상태로 처리 ──────────

const PAGE_SIZE = 12;

export const fetchArtworks = async (
  cardId?: string,
  cursor?: ArtworkCursor,
): Promise<ArtworksData> => {
  const data = await serverApi.get<ServerArtworksResponse>(ARTWORK_ENDPOINTS.list, {
    params: {
      size: PAGE_SIZE,
      cardId,
      lastId: cursor?.lastId,
      lastSortOrder: cursor?.lastSortOrder,
    },
  });
  return ArtworkTransformer.toArtworksData(data);
};

// cache(): 같은 렌더 패스에서 같은 id 중복 호출을 1회로 합친다(레이아웃+페이지 동시 조회 등).
export const fetchArtworkDetail = cache(
  async (id: string): Promise<ArtworkDetail> => {
    const data = await serverApi.get<ServerArtworkDetail>(
      ARTWORK_ENDPOINTS.detail(id),
    );
    return ArtworkTransformer.toDetail(data);
  },
);

// ── 쓰기(뮤테이션용) ─ withErrorHandling → ServerActionResult 반환(throw 안 함) ──

const _toggleRecommend = async (
  artworkId: string,
): Promise<ServerRecommendResult> =>
  serverApi.post<ServerRecommendResult>(ARTWORK_ENDPOINTS.recommend(artworkId));

export const toggleRecommend = withErrorHandling(_toggleRecommend);
