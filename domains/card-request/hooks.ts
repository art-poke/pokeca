"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import type { Format } from "@/lib/formats";
import { CARD_REQUEST_ENDPOINTS } from "./api/endpoints";
import { cardRequestKeys } from "./api/queries";
import type { CardRequestsMap } from "./api/types";

// 카드 규격별 요청 현황(계정별). 마운트 후 조회.
export const useCardRequestsQuery = (cardId: string) =>
  useQuery({
    queryKey: cardRequestKeys.byCard(cardId),
    queryFn: () =>
      apiFetch<CardRequestsMap>(CARD_REQUEST_ENDPOINTS.statuses(cardId)),
  });

// 카드 상세의 두 요청 버튼이 같은 요청 현황을 사용한다.
export const useRequestFormatMutation = (cardId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (format: Format) =>
      apiFetch<CardRequestsMap>(CARD_REQUEST_ENDPOINTS.statuses(cardId), {
        method: "POST",
        body: JSON.stringify({ format }),
      }),
    onSuccess: async (map) => {
      const queryKey = cardRequestKeys.byCard(cardId);
      await qc.cancelQueries({ queryKey });
      qc.setQueryData(queryKey, map);
      void qc.invalidateQueries({ queryKey });
    },
    meta: { skipGlobalError: true },
  });
};
