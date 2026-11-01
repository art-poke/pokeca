"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { REVIEW_ENDPOINTS } from "./api/endpoints";
import type { CreateReviewInput } from "./api/types";

// 작가 후기 작성/삭제. 이미지 업로드(uploadFile)는 컴포넌트가 선행하고 imageUploadId만 넘긴다.
// 컴포넌트가 성공/실패 UX를 직접 처리(mutateAsync) → skipGlobalError.
export const useCreateReviewMutation = () =>
  useMutation({
    mutationFn: (input: CreateReviewInput) =>
      apiFetch<void>(REVIEW_ENDPOINTS.create, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    meta: { skipGlobalError: true },
  });

export const useDeleteReviewMutation = () =>
  useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(REVIEW_ENDPOINTS.remove(id), { method: "DELETE" }),
    meta: { skipGlobalError: true },
  });
