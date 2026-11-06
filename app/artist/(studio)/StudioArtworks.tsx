"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { MyArtwork } from "@/lib/artists";
import { FORMAT_INFO, FORMATS, type Format } from "@/lib/formats";
import { cn } from "@/lib/utils";
import { VisibilityToggle } from "./VisibilityToggle";
import { WithdrawMine } from "./WithdrawMine";

const STATUS = {
  active: { label: "공개", variant: "soft" as const },
  hidden: { label: "비공개", variant: "muted" as const },
  withdrawn: { label: "내림", variant: "muted" as const },
};

type Filter = "all" | Format;

// 내 도안: 규격별 분류 탭 + 상태 배지로 작가가 자기 카테고리를 한눈에.
export function StudioArtworks({ works }: { works: MyArtwork[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const counts = Object.fromEntries(
    FORMATS.map((f) => [f, works.filter((w) => w.format === f).length]),
  ) as Record<Format, number>;
  const shown = filter === "all" ? works : works.filter((w) => w.format === filter);

  return (
    <section aria-labelledby="mine" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="mine" className="font-display text-xl font-bold text-foreground">
          내 도안 {works.length}개
        </h2>
        <Link
          href="/artist/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-red-700"
        >
          <Plus className="size-4" />
          새 도안 올리기
        </Link>
      </div>

      {works.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          아직 올린 도안이 없어요. ‘새 도안 올리기’로 첫 도안을 올려보세요.
        </div>
      ) : (
        <>
          {/* 규격 분류 */}
          <div className="scrollbar-none flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1 sm:inline-flex">
            {(["all", ...FORMATS] as Filter[]).map((f) => {
              const count = f === "all" ? works.length : counts[f];
              const selected = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                    selected
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f === "all" ? "전체" : FORMAT_INFO[f].label}
                  <span
                    className={cn(
                      "tabular rounded-full px-1.5 text-xs",
                      selected ? "bg-muted text-ink-600" : "bg-background/60 text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {shown.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
              이 규격으로 올린 도안이 없어요.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((a) => (
                <li
                  key={a.id}
                  className="group overflow-hidden rounded-2xl border border-border bg-background transition-shadow hover:shadow-md"
                >
                  <Link href={`/artworks/${a.id}`} className="block">
                    <div className="relative aspect-[63/88] w-full bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/thumbnails/${a.id}`}
                        alt={a.title}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                      <span className="absolute left-2 top-2">
                        <Badge variant={STATUS[a.status].variant}>{STATUS[a.status].label}</Badge>
                      </span>
                    </div>
                  </Link>
                  <div className="space-y-1 p-3">
                    <div className="flex items-center justify-between gap-1.5">
                      <Badge variant="muted">{FORMAT_INFO[a.format as Format]?.label ?? a.format}</Badge>
                      {a.status !== "withdrawn" && (
                        <div className="flex items-center gap-2.5">
                          <VisibilityToggle id={a.id} status={a.status as "active" | "hidden"} />
                          <WithdrawMine id={a.id} cardLabel={a.card.label} />
                        </div>
                      )}
                    </div>
                    <p className="truncate text-sm font-semibold text-foreground">{a.title}</p>
                    <p className="tabular truncate text-xs text-muted-foreground">
                      {a.card.label} {a.card.name}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
