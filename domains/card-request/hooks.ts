"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import type { Format } from "@/lib/formats";
import { CARD_REQUEST_ENDPOINTS } from "./api/endpoints";
import { cardRequestKeys } from "./api/queries";
import type { CardRequestsMap } from "./api/types";

// 카드 규격별 요청 현황(방문자별). 페이지 HTML은 방문자 무관이라 마운트 후 조회.
export const useCardRequestsQuery = (cardId: string) =>
  useQuery({
    queryKey: cardRequestKeys.byCard(cardId),
    queryFn: () =>
      apiFetch<CardRequestsMap>(CARD_REQUEST_ENDPOINTS.statuses(cardId)),
  });

// 빈 상태에서 규격 요청 → 갱신된 현황 맵으로 캐시 갱신(키 처리는 훅이 캡슐화).
export const useRequestFormatMutation = (cardId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (format: Format) =>
      apiFetch<CardRequestsMap>(CARD_REQUEST_ENDPOINTS.statuses(cardId), {
        method: "POST",
        body: JSON.stringify({ format }),
      }),
    onSuccess: (map) => qc.setQueryData(cardRequestKeys.byCard(cardId), map),
    meta: { skipGlobalError: true },
  });
};

// 없는 규격 요청 버튼(단건).
export const useRequestArtMutation = (cardId: string) =>
  useMutation({
    mutationFn: (format: Format) =>
      apiFetch<void>(CARD_REQUEST_ENDPOINTS.request(cardId), {
        method: "POST",
        body: JSON.stringify({ format }),
      }),
    meta: { skipGlobalError: true },
  });
