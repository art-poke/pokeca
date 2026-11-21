"use client";

import { Eye } from "lucide-react";
import { useStoryViews } from "@/domains/story/hooks";

export function StoryViewCount({ slug }: { slug: string }) {
  const views = useStoryViews(slug);
  if (views === undefined) return null;

  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <Eye className="size-4" aria-hidden />
      조회 {views.toLocaleString("ko-KR")}명
    </span>
  );
}
