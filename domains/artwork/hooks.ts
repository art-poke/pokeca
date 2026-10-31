"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { showErrorToast } from "@/lib/toast/gr-toast";
import { fetchArtworkDetail, fetchArtworks, toggleRecommend } from "./api/actions";
import { artworkKeys } from "./api/queries";
import type { ArtworkCursor, ArtworkDetail, ArtworksData } from "./api/types";

// ---------------------------------------------------------------------------
// 도메인 훅. 컴포넌트는 이 훅만 호출한다(actions/queries 직접 호출 금지).
// 작으면 이 한 파일에 둔다. 커지면 hooks/{api,features,ui}로 쪼갠다.
// ---------------------------------------------------------------------------

// ── 읽기 ─────────────────────────────────────────────────────────────────────

/** 목록(커서 무한스크롤). cardId 없으면 홈 최신 피드. */
export const useArtworksQuery = (cardId?: string) =>
  useInfiniteQuery({
    queryKey: artworkKeys.list(cardId),
    queryFn: ({ pageParam }: { pageParam: ArtworkCursor | undefined }) =>
      fetchArtworks(cardId, pageParam),
    initialPageParam: undefined as ArtworkCursor | undefined,
    getNextPageParam: (last) =>
      last.hasNext && last.nextCursor ? last.nextCursor : undefined,
  });

export const useArtworkDetailQuery = (id: string) =>
  useQuery({
    queryKey: artworkKeys.detail(id),
    queryFn: () => fetchArtworkDetail(id),
  });

// ── 쓰기(추천 토글, 낙관적 업데이트) ──────────────────────────────────────────

type InfiniteArtworks = InfiniteData<ArtworksData>;

export const useToggleRecommendMutation = (id: string) => {
  const qc = useQueryClient();
  const detailKey = artworkKeys.detail(id);

  const patch = (delta: { recommended: boolean; count?: number }) => {
    // 상세 캐시
    qc.setQueryData<ArtworkDetail>(detailKey, (old) =>
      old
        ? {
            ...old,
            isRecommended: delta.recommended,
            recommendCount:
              delta.count ??
              old.recommendCount + (delta.recommended ? 1 : -1),
          }
        : old,
    );
    // 열려있는 모든 목록 캐시의 해당 아이템
    qc.setQueriesData<InfiniteArtworks>({ queryKey: artworkKeys.lists() }, (old) =>
      old
        ? {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((it) =>
                it.id === id
                  ? {
                      ...it,
                      isRecommended: delta.recommended,
                      recommendCount:
                        delta.count ??
                        it.recommendCount + (delta.recommended ? 1 : -1),
                    }
                  : it,
              ),
            })),
          }
        : old,
    );
  };

  return useMutation({
    mutationFn: () => toggleRecommend(id),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: detailKey });
      const prevDetail = qc.getQueryData<ArtworkDetail>(detailKey);
      const prevLists = qc.getQueriesData<InfiniteArtworks>({
        queryKey: artworkKeys.lists(),
      });
      patch({ recommended: !prevDetail?.isRecommended });
      return { prevDetail, prevLists };
    },
    onSuccess: (result, _vars, ctx) => {
      if (result.success) {
        // 서버 진실로 동기화(동시추천 등 카운트 보정).
        patch({
          recommended: result.data.recommended,
          count: result.data.recommendCount,
        });
        return;
      }
      // 비즈니스 거부(예: already_downloaded) — 롤백 후 안내 문구.
      rollback(ctx);
      showErrorToast(result.code ?? undefined);
    },
    onError: (_e, _vars, ctx) => rollback(ctx),
  });

  function rollback(ctx?: {
    prevDetail?: ArtworkDetail;
    prevLists?: [readonly unknown[], InfiniteArtworks | undefined][];
  }) {
    if (ctx?.prevDetail) qc.setQueryData(detailKey, ctx.prevDetail);
    ctx?.prevLists?.forEach(([key, data]) => qc.setQueryData(key, data));
  }
};
