"use client";

import { useState } from "react";
import { useCardRequestsQuery, useRequestFormatMutation } from "@/domains/card-request/hooks";
import type { PublicArtwork } from "@/lib/artworks";
import { FORMAT_INFO, FORMATS, type Format } from "@/lib/formats";
import { cn } from "@/lib/utils";
import { ArtworkItem } from "./ArtworkItem";

// 카드 상세의 작품 영역. 규격 필터 → 미리보기 타일 그리드 / 빈 상태(찾기 요청).
// 요청 상태는 방문자별이라 마운트 뒤 따로 불러온다(페이지 HTML은 방문자와 무관).

type Filter = "all" | Format;
type RequestStatus = { requested: boolean; waiting: number | null };
type Pending = { format: Format; phase: "sending" | "failed" } | null;

export function FormatResults({ cardId, artworks }: { cardId: string; artworks: PublicArtwork[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, setPending] = useState<Pending>(null);
  const { data: requests } = useCardRequestsQuery(cardId);
  const { mutate: requestFormat } = useRequestFormatMutation(cardId);

  function request(format: Format) {
    setPending({ format, phase: "sending" });
    requestFormat(format, {
      onSuccess: () => setPending(null), // 캐시 갱신은 훅이 처리
      onError: () => setPending({ format, phase: "failed" }),
    });
  }

  const counts = Object.fromEntries(
    FORMATS.map((f) => [f, artworks.filter((a) => a.format === f).length]),
  ) as Record<Format, number>;
  const shown = filter === "all" ? artworks : artworks.filter((a) => a.format === filter);
  const filterLabel = filter === "all" ? "전체" : FORMAT_INFO[filter].label;

  return (
    <section aria-labelledby="artworks-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="artworks-heading" className="font-display text-xl font-bold text-foreground md:text-2xl">
          확장 아트 도안 {artworks.length}개
        </h2>
        <div
          className="scrollbar-none flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-muted p-1 sm:inline-flex"
          role="group"
          aria-label="규격"
        >
          {(["all", ...FORMATS] as Filter[]).map((f) => {
            const count = f === "all" ? artworks.length : counts[f];
            const selected = filter === f;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={selected}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                  selected
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "전체" : FORMAT_INFO[f].label}
                {f !== "all" && (
                  <span
                    className={cn(
                      "tabular rounded-full px-1.5 text-xs",
                      selected ? "bg-muted text-ink-600" : "bg-background/60 text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                )}
                {f !== "all" && requests?.[f]?.requested && count === 0 && (
                  <span className="text-xs font-medium text-primary">요청함</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="visually-hidden" aria-live="polite">
        {filterLabel} 도안 {shown.length}개
      </p>

      {shown.length === 0 ? (
        filter === "all" ? (
          <FindRequestAny requests={requests ?? null} pending={pending} onRequest={request} />
        ) : (
          <FindRequest
            format={filter}
            status={requests?.[filter]}
            pending={pending}
            onRequest={request}
          />
        )
      ) : (
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          aria-label="도안"
        >
          {shown.map((a) => (
            <ArtworkItem key={a.id} artwork={a} />
          ))}
        </ul>
      )}
    </section>
  );
}

type RequestProps = {
  pending: Pending;
  onRequest: (format: Format) => void;
};

const requestButtonCls =
  "inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-red-600 disabled:opacity-60";

function Waiting({ status }: { status?: RequestStatus }) {
  return status?.waiting ? (
    <p className="mt-2 text-sm text-muted-foreground">{status.waiting}명이 기다리는 중</p>
  ) : null;
}

function Failed({ pending, format }: { pending: Pending; format?: Format }) {
  return pending?.phase === "failed" && (!format || pending.format === format) ? (
    <p className="mt-2 text-sm text-destructive">기록하지 못했어요. 다시 시도해 주세요.</p>
  ) : null;
}

function FindRequest({
  format,
  status,
  pending,
  onRequest,
}: RequestProps & { format: Format; status?: RequestStatus }) {
  const label = FORMAT_INFO[format].label;
  const sending = pending?.format === format && pending.phase === "sending";
  return (
    <div className="rounded-2xl border border-dashed border-border bg-background p-8 text-center">
      <h3 className="font-display text-lg font-bold text-foreground">
        이 카드의 {label} 도안 찾아 주세요
      </h3>
      {status?.requested ? (
        <p className="mt-2 text-sm text-muted-foreground">
          요청이 기록됐어요 · 등록되면 이 페이지에 나타나요
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">기존 도안을 찾아 등록할 때 참고해요</p>
          <button
            type="button"
            className={cn(requestButtonCls, "mt-4")}
            disabled={sending}
            onClick={() => onRequest(format)}
          >
            {sending ? "기록 중…" : "찾기 요청"}
          </button>
        </>
      )}
      <div role="status">
        <Failed pending={pending} format={format} />
      </div>
      <Waiting status={status} />
    </div>
  );
}

// 카드 전체에 도안이 없을 때: 규격을 골라 요청한다.
function FindRequestAny({
  requests,
  pending,
  onRequest,
}: RequestProps & { requests: Record<Format, RequestStatus> | null }) {
  const requestedAny = FORMATS.some((f) => requests?.[f]?.requested);
  return (
    <div className="rounded-2xl border border-dashed border-border bg-background p-8 text-center">
      <h3 className="font-display text-lg font-bold text-foreground">
        아직 등록된 도안이 없어요. 어떤 규격이 필요하세요?
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {requestedAny
          ? "요청이 기록됐어요 · 등록되면 이 페이지에 나타나요"
          : "기존 도안을 찾아 등록할 때 참고해요"}
      </p>
      <div className="mt-5 flex flex-wrap items-start justify-center gap-3">
        {FORMATS.map((f) => {
          const done = requests?.[f]?.requested;
          const sending = pending?.format === f && pending.phase === "sending";
          return (
            <div key={f} className="text-center">
              <button
                type="button"
                className={requestButtonCls}
                disabled={done || sending}
                onClick={() => onRequest(f)}
              >
                {sending
                  ? "기록 중…"
                  : done
                    ? `${FORMAT_INFO[f].label} 요청함`
                    : `${FORMAT_INFO[f].label} 찾기 요청`}
              </button>
              <Waiting status={requests?.[f]} />
            </div>
          );
        })}
      </div>
      <div role="status">
        <Failed pending={pending} />
      </div>
    </div>
  );
}
