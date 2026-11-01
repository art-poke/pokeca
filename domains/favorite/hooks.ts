"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { FAVORITE_ENDPOINTS } from "./api/endpoints";
import type { ToggleFavoriteResult } from "./api/types";

// 카드 즐겨찾기 토글. 같은 Next의 /api/member/favorites route를 호출한다.
// 낙관적 상태는 호출 컴포넌트(버튼)가 들고, 실패 시 onError로 롤백.
// skipGlobalError: 버튼이 code별로 직접 처리(401은 로그인 유도).
export const useToggleFavoriteMutation = () =>
  useMutation({
    mutationFn: (cardId: string) =>
      apiFetch<ToggleFavoriteResult>(FAVORITE_ENDPOINTS.toggle, {
        method: "POST",
        body: JSON.stringify({ cardId }),
      }),
    meta: { skipGlobalError: true },
  });
