"use client";

import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useArtistSearchQuery } from "@/domains/artist/hooks";

// 커뮤니티 후기: 작가 이름/핸들로 검색 → 작가 페이지로 가서 후기 남기기.
export function ReviewArtistSearch() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const { data: hits, isFetching: loading } = useArtistSearchQuery(submitted);

  const run = (value: string) => setSubmitted(value.trim());

  return (
    <div className="space-y-2.5 rounded-2xl border border-border bg-background p-4">
      <label htmlFor="artist-q" className="text-sm font-semibold text-foreground">
        작가 검색해서 후기 남기기
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id="artist-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run(q)}
            placeholder="작가 이름 또는 @핸들"
            className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
        <button
          type="button"
          onClick={() => run(q)}
          disabled={loading}
          className="h-11 shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-red-700 disabled:opacity-60"
        >
          {loading ? "찾는 중…" : "검색"}
        </button>
      </div>

      {hits && hits.length === 0 && <p className="text-sm text-muted-foreground">맞는 작가가 없어요.</p>}
      {hits && hits.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {hits.map((a) => (
            <li key={a.userId}>
              <Link
                href={`/artists/${a.handle}`}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-gray-50"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
                  {a.displayName[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{a.displayName}</div>
                  <div className="tabular truncate text-xs text-muted-foreground">@{a.handle}</div>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
