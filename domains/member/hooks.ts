"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { MEMBER_ENDPOINTS } from "./api/endpoints";
import type { UpdateProfileInput } from "./api/types";

// 마이프로필 수정(닉네임 + 아바타). 아바타 업로드(uploadFile)는 컴포넌트가 선행.
// 컴포넌트가 성공/실패 UX를 직접 처리(mutateAsync) → skipGlobalError.
export const useUpdateProfileMutation = () =>
  useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      apiFetch<void>(MEMBER_ENDPOINTS.profile, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    meta: { skipGlobalError: true },
  });
