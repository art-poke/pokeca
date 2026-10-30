"use client";

import { Download, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { PublicArtwork } from "@/lib/artworks";
import { FORMAT_INFO } from "@/lib/formats";
import { cn } from "@/lib/utils";

// 작품 하나. 미리보기(누르면 크게 보기) + 카드번호(옵션) + @작가·규격 + 다운로드 + ···(신고)
export function ArtworkItem({
  artwork,
  card,
  onView,
  onReport,
}: {
  artwork: PublicArtwork;
  card?: { label: string; path: string; name: string };
  onView: (a: PublicArtwork) => void;
  onReport: (a: PublicArtwork) => void;
}) {
  const label = FORMAT_INFO[artwork.format].label;
  return (
    <li
      className="group overflow-hidden rounded-2xl border border-border bg-background transition-shadow hover:shadow-md"
      data-testid="artwork"
    >
      <button
        type="button"
        className="relative block aspect-[63/88] w-full overflow-hidden bg-gray-100"
        onClick={() => onView(artwork)}
        aria-label={`@${artwork.artistName}의 ${label} 도안 크게 보기`}
      >
        {/* 서명 URL로 리다이렉트되는 상태 확인 경로라 next/image 최적화를 쓰지 않는다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/thumbnails/${artwork.id}`}
          alt={`@${artwork.artistName}의 ${label} 확장 아트 도안`}
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </button>
      <div className="p-3">
        {card && (
          <p className="mb-1 flex items-center gap-1.5 text-sm">
            <Link href={card.path} className="tabular font-semibold text-foreground hover:text-primary">
              {card.label}
            </Link>
            <span className="truncate text-muted-foreground">{card.name}</span>
          </p>
        )}
        <p className="flex items-center gap-1.5 text-sm">
          <ArtistName artwork={artwork} />
          <Badge variant="muted">{label}</Badge>
        </p>
        <div className="mt-3 flex items-center gap-2">
          <DownloadAction artwork={artwork} />
          <MoreMenu artwork={artwork} onReport={onReport} />
        </div>
      </div>
    </li>
  );
}

// 승인된 작가 계정의 작품이면 작가 페이지로 잇는다.
export function ArtistName({ artwork }: { artwork: PublicArtwork }) {
  return artwork.artistHandle ? (
    <Link
      href={`/artists/${artwork.artistHandle}`}
      className="font-semibold text-foreground hover:text-primary"
    >
      @{artwork.artistName}
    </Link>
  ) : (
    <strong className="font-semibold text-foreground">@{artwork.artistName}</strong>
  );
}

// 출처 표시 링크. 측정은 실패해도 이동을 막지 않는다.
export function SourceLink({ artwork }: { artwork: PublicArtwork }) {
  if (!artwork.sourceUrl) return null;
  return (
    <span className="text-sm text-muted-foreground">
      <a
        href={artwork.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-ink-600 underline-offset-2 hover:text-primary hover:underline"
        onClick={() => {
          navigator.sendBeacon?.(
            "/api/events",
            JSON.stringify({ type: "source_click", artworkId: artwork.id }),
          );
        }}
      >
        작가 원본 글 ↗<span className="visually-hidden">(새 탭)</span>
      </a>
      {artwork.sourceDomain && <span> · {artwork.sourceDomain}</span>}
      {artwork.membersOnly && <span> · 카페 가입 필요</span>}
    </span>
  );
}

type DownloadState = "idle" | "loading" | "failed" | "gone";
const NOTICE_KEY = "print-notice-shown";

export function DownloadAction({ artwork }: { artwork: PublicArtwork }) {
  const router = useRouter();
  const [state, setState] = useState<DownloadState>("idle");
  const [notice, setNotice] = useState(false);

  async function download() {
    setState("loading");
    try {
      const res = await fetch(`/api/download/${artwork.id}`, { method: "POST" });
      if (res.status === 410 || res.status === 404) {
        setState("gone");
        router.refresh();
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const { url } = await res.json();
      // 서명 URL은 클릭 시점에 받아 바로 쓰고 화면에 남기지 않는다.
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener";
      document.body.append(a);
      a.click();
      a.remove();
      setState("idle");
      // 인쇄 안내는 같은 세션에서 한 번만.
      let shown = false;
      try {
        shown = sessionStorage.getItem(NOTICE_KEY) === "1";
        sessionStorage.setItem(NOTICE_KEY, "1");
      } catch {}
      if (!shown) setNotice(true);
    } catch {
      setState("failed");
    }
  }

  const printSize = FORMAT_INFO[artwork.format].printSize;
  return (
    <>
      <button
        type="button"
        className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-red-600 disabled:opacity-60"
        onClick={download}
        disabled={state === "loading" || state === "gone"}
        aria-label={`@${artwork.artistName} ${FORMAT_INFO[artwork.format].label} 도안 다운로드`}
      >
        <Download className="size-4" aria-hidden />
        {state === "loading" ? "준비 중…" : "다운로드"}
      </button>
      <div role="status">
        {state === "failed" && (
          <p className="mt-2 text-sm text-destructive">파일을 준비하지 못했어요. 다시 시도해 주세요.</p>
        )}
        {state === "gone" && (
          <p className="mt-2 text-sm text-destructive">이 도안은 더 이상 제공되지 않아요.</p>
        )}
        {notice && (
          <div className="mt-2 rounded-xl bg-muted p-3 text-sm text-ink-700">
            <p>
              인쇄할 때 크기는 ‘실제 크기(100%)’로, ‘페이지에 맞추기’는 끄세요.{" "}
              {artwork.printSizeVerified && printSize
                ? `이 파일은 ${printSize}로 확인됐어요.`
                : artwork.sourceUrl
                  ? "작가의 원본 글에 있는 인쇄 안내를 함께 확인하세요."
                  : `${FORMAT_INFO[artwork.format].label} 규격에 맞춰 인쇄하세요.`}
            </p>
            <button
              type="button"
              className="mt-2 font-semibold text-primary hover:underline"
              onClick={() => setNotice(false)}
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function MoreMenu({
  artwork,
  onReport,
}: {
  artwork: PublicArtwork;
  onReport: (a: PublicArtwork) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuId = `more-${artwork.id}`;
  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-lg border border-border text-ink-600 transition-colors hover:bg-gray-50",
          open && "bg-gray-100",
        )}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`@${artwork.artistName} 도안 더보기`}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute right-0 z-20 mt-1.5 min-w-[11rem] rounded-xl border border-border bg-popover p-1.5 shadow-md"
        >
          <button
            type="button"
            className="flex w-full items-center rounded-lg px-2.5 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-gray-100"
            onClick={() => {
              setOpen(false);
              onReport(artwork);
            }}
          >
            신고·내림 요청
          </button>
        </div>
      )}
    </div>
  );
}
