"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { SEARCH_REQUEST_ENDPOINTS } from "./api/endpoints";

// 검색 결과 없음 → "카드 추가 요청" 기록. 컴포넌트가 상태를 직접 표시하므로 전역 토스트 끔.
export const useCreateSearchRequestMutation = () =>
  useMutation({
    mutationFn: (query: string) =>
      apiFetch<void>(SEARCH_REQUEST_ENDPOINTS.create, {
        method: "POST",
        body: JSON.stringify({ query }),
      }),
    meta: { skipGlobalError: true },
  });
