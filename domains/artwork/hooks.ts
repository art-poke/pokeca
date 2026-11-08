"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { showErrorToast } from "@/lib/toast/gr-toast";
import { fetchArtworkDetail, fetchRecentArtworks, fetchRecentArtworksPage } from "./api/actions";
import { artworkKeys } from "./api/queries";
import type { ArtworkDetail, ArtworkFeedPage, RecommendResult } from "./api/types";
import { downloadArtwork } from "./download";

const FEED_PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// 도메인 훅. 컴포넌트는 이 훅만 호출한다(actions/apiFetch 직접 호출 금지).
// 읽기 = 서버액션(lib 직접) · 쓰기 = 기존 API route 호출.
// ---------------------------------------------------------------------------

export const useRecentArtworksQuery = (limit?: number) =>
  useQuery({
    queryKey: artworkKeys.list(),
    queryFn: () => fetchRecentArtworks(limit),
  });

// "최근 도안 더 보기" 무한스크롤. 1페이지는 서버가 SSR로 넘겨(initial), 이후 서버액션으로 이어 받는다.
export const useRecentArtworksInfinite = (initial: ArtworkFeedPage) =>
  useInfiniteQuery({
    queryKey: artworkKeys.feed(),
    queryFn: ({ pageParam }) => fetchRecentArtworksPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length * FEED_PAGE_SIZE : undefined,
    initialData: { pages: [initial], pageParams: [0] },
  });

export const useArtworkDetailQuery = (id: string) =>
  useQuery({
    queryKey: artworkKeys.detail(id),
    queryFn: () => fetchArtworkDetail(id),
  });

// 추천 토글(낙관적 업데이트 + 롤백). already_downloaded 등 거부는 code로 안내.
export const useToggleRecommendMutation = (id: string) => {
  const qc = useQueryClient();
  const key = artworkKeys.detail(id);

  return useMutation({
    mutationFn: () =>
      apiFetch<RecommendResult>(`/api/artworks/${id}/recommend`, {
        method: "POST",
      }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ArtworkDetail>(key);
      if (prev) {
        qc.setQueryData<ArtworkDetail>(key, {
          ...prev,
          isRecommended: !prev.isRecommended,
          recommendCount: prev.recommendCount + (prev.isRecommended ? -1 : 1),
        });
      }
      return { prev };
    },
    onSuccess: (data) => {
      const cur = qc.getQueryData<ArtworkDetail>(key);
      if (cur) qc.setQueryData<ArtworkDetail>(key, { ...cur, isRecommended: data.recommended });
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev); // 롤백
      showErrorToast(isApiError(error) ? error.code ?? undefined : undefined);
    },
    meta: { skipGlobalError: true },
  });
};

// 추천 토글(쿼리 캐시 없이 로컬 상태로 쓰는 화면용 — 서버렌더 상세 페이지 등).
export const useRecommendArtworkMutation = (artworkId: string) =>
  useMutation({
    mutationFn: () =>
      apiFetch<RecommendResult>(`/api/artworks/${artworkId}/recommend`, {
        method: "POST",
      }),
    meta: { skipGlobalError: true },
  });

// 도안 다운로드. 성공/실패 UX(인쇄 안내·로그인 유도)는 호출 컴포넌트가 분기.
export const useDownloadArtworkMutation = () =>
  useMutation({
    mutationFn: (artworkId: string) => downloadArtwork(artworkId),
    meta: { skipGlobalError: true },
  });
