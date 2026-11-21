"use client";

import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { fetchStoryFeed } from "./actions";
import type { StoryFeedPage, StoryFilter } from "./types";

export function useStoryFeed(category: StoryFilter, excludedSlug: string, initial: StoryFeedPage) {
  return useInfiniteQuery({
    queryKey: ["story-feed", category, excludedSlug],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchStoryFeed(category, excludedSlug, pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    initialData: { pages: [initial], pageParams: [null] },
    refetchOnMount: "always",
  });
}

export function useStoryViews(slug: string) {
  const [result, setResult] = useState<{ slug: string; views: number }>();

  useEffect(() => {
    const controller = new AbortController();

    function recordView() {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", recordView);
      void apiFetch<{ views: number }>(`/api/stories/${encodeURIComponent(slug)}/views`, {
        method: "POST",
        signal: controller.signal,
      }).then(({ views }) => setResult({ slug, views })).catch(() => {
        // 집계 실패 시 글은 그대로 읽을 수 있다.
      });
    }

    document.addEventListener("visibilitychange", recordView);
    recordView();
    return () => {
      document.removeEventListener("visibilitychange", recordView);
      controller.abort();
    };
  }, [slug]);

  return result?.slug === slug ? result.views : undefined;
}

export function useStoryLikeMutation(slug: string) {
  return useMutation({
    mutationFn: (liked: boolean) => apiFetch<{ liked: boolean; count: number }>(
      `/api/stories/${encodeURIComponent(slug)}/likes`,
      { method: "PUT", body: JSON.stringify({ liked }) },
    ),
    meta: { skipGlobalError: true },
  });
}
