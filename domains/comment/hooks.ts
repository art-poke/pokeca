"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { COMMENT_ENDPOINTS } from "./api/endpoints";
import type { CreateCommentInput } from "./api/types";

// 댓글 작성/삭제. 목록은 서버렌더 + router.refresh로 갱신하므로 컴포넌트가 onSuccess에서 refresh.
// 401 등은 컴포넌트가 code/status로 분기(로그인 유도) → skipGlobalError.
export const useCreateCommentMutation = () =>
  useMutation({
    mutationFn: (input: CreateCommentInput) =>
      apiFetch<void>(COMMENT_ENDPOINTS.create, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    meta: { skipGlobalError: true },
  });

export const useDeleteCommentMutation = () =>
  useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(COMMENT_ENDPOINTS.remove(id), { method: "DELETE" }),
    meta: { skipGlobalError: true },
  });
