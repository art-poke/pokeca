"use client";

import { useEffect, useRef } from "react";
import { useStoryFeed } from "@/domains/story/hooks";
import type { StoryFeedPage, StoryFilter } from "@/domains/story/types";
import { StoryCard } from "./story-card";

export function StoryFeed({ category, featuredSlug, initial }: { category: StoryFilter; featuredSlug: string; initial: StoryFeedPage }) {
  const { data, fetchNextPage, hasNextPage, isFetching, isFetchNextPageError } = useStoryFeed(category, featuredSlug, initial);
  const sentinel = useRef<HTMLButtonElement>(null);
  const stories = data.pages.flatMap((page) => page.items);

  useEffect(() => {
    const trigger = sentinel.current;
    if (!trigger || !hasNextPage || isFetching || isFetchNextPageError || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void fetchNextPage({ cancelRefetch: false });
    }, { rootMargin: "300px" });
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetching, isFetchNextPageError]);

  if (stories.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 px-5 py-6 text-sm text-slate-600">다음 이야기도 낋이는 중이에요.</p>;
  }

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2">
        {stories.map((story) => <li key={story.slug}><StoryCard story={story} /></li>)}
      </ul>
      {hasNextPage && (
        <button
          ref={sentinel}
          type="button"
          disabled={isFetching}
          onClick={() => void fetchNextPage({ cancelRefetch: false })}
          className="mx-auto block rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {isFetching ? "불러오는 중…" : isFetchNextPageError ? "다시 불러오기" : "이야기 더 보기"}
        </button>
      )}
    </>
  );
}
