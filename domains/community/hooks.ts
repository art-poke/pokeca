"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { COMMUNITY_ENDPOINTS } from "./api/endpoints";
import type { CreatePostInput, CreatePostResult } from "./api/types";

// 게시글 작성/삭제. 성공 후 이동·갱신은 컴포넌트가(router). 401/403은 컴포넌트가 분기 → skipGlobalError.
export const useCreatePostMutation = () =>
  useMutation({
    mutationFn: (input: CreatePostInput) =>
      apiFetch<CreatePostResult>(COMMUNITY_ENDPOINTS.createPost, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    meta: { skipGlobalError: true },
  });

export const useDeletePostMutation = () =>
  useMutation({
    mutationFn: (postId: string) =>
      apiFetch<void>(COMMUNITY_ENDPOINTS.removePost(postId), { method: "DELETE" }),
    meta: { skipGlobalError: true },
  });
