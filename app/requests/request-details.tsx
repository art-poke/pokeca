"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { RequestedItem } from "@/lib/art-requests";

export function RequestDetails({ item, rank }: { item: RequestedItem; rank: number }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:gap-3"
        >
          <span className="w-6 shrink-0 text-center text-sm font-bold text-muted-foreground">{rank}</span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="tabular font-semibold text-foreground">{item.cardLabel}</span>
              <Badge variant="secondary">{item.formatLabel}</Badge>
            </span>
            <span className="block truncate text-sm text-muted-foreground">{item.name}</span>
          </span>
          <Badge variant="primary" className="shrink-0">요청 {item.count}</Badge>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-background p-5 shadow-xl sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Dialog.Title className="break-words font-display text-xl font-bold text-foreground">
                {item.name} 도안 요청
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {item.cardLabel} · {item.formatLabel}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="닫기"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-gray-100"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <h3 className="mb-2 mt-5 text-sm font-semibold text-foreground">요청자 {item.count}명</h3>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {item.requesters.map((name, index) => (
              <li key={index} className="break-words px-3 py-2.5 text-sm text-foreground">
                {name ? `${name}님` : "익명 요청"}
              </li>
            ))}
          </ul>
          <Link
            href={item.cardPath}
            className="mt-5 flex w-full items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            카드 상세 보기
          </Link>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
