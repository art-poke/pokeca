"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { PublicArtwork } from "@/lib/artworks";
import { FORMAT_INFO } from "@/lib/formats";

// 그리드 아이템: 도안·제목·규격·작가명만. 클릭하면 상세 페이지(/artworks/[id])로.
// 다운로드·추천·신고·댓글은 상세 페이지에 있다.
export function ArtworkItem({
  artwork,
  card,
}: {
  artwork: PublicArtwork;
  card?: { label: string; path: string; name: string };
}) {
  const label = FORMAT_INFO[artwork.format].label;
  return (
    <li
      className="group overflow-hidden rounded-2xl border border-border bg-background transition-shadow hover:shadow-md"
      data-testid="artwork"
    >
      <Link href={`/artworks/${artwork.id}`} className="block">
        <div className="relative aspect-[63/88] w-full overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/thumbnails/${artwork.id}`}
            alt={`${artwork.title} (@${artwork.artistName})`}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
        <div className="p-3">
          {card && (
            <p className="tabular mb-1 truncate text-xs font-medium text-muted-foreground">
              {card.label} {card.name}
            </p>
          )}
          <p className="truncate font-semibold text-foreground group-hover:text-primary">
            {artwork.title}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="truncate">@{artwork.artistName}</span>
            <Badge variant="muted">{label}</Badge>
          </p>
        </div>
      </Link>
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

type DownloadState = "idle" | "loading" | "failed" | "gone" | "login";
const NOTICE_KEY = "print-notice-shown";

// 다운로드(회원 전용). 비회원은 401 → 로그인 안내.
export function DownloadAction({ artwork }: { artwork: PublicArtwork }) {
  const router = useRouter();
  const [state, setState] = useState<DownloadState>("idle");
  const [notice, setNotice] = useState(false);

  async function download() {
    setState("loading");
    try {
      const res = await fetch(`/api/download/${artwork.id}`, { method: "POST" });
      if (res.status === 401) {
        setState("login");
        return;
      }
      if (res.status === 410 || res.status === 404) {
        setState("gone");
        router.refresh();
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const { url } = await res.json();
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener";
      document.body.append(a);
      a.click();
      a.remove();
      setState("idle");
      router.refresh();
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
    <div>
      <button
        type="button"
        className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-red-700 disabled:opacity-60"
        onClick={download}
        disabled={state === "loading" || state === "gone"}
      >
        <Download className="size-4" aria-hidden />
        {state === "loading" ? "준비 중…" : "다운로드"}
      </button>
      <div role="status">
        {state === "login" && (
          <p className="mt-2 text-sm text-muted-foreground">
            다운로드는 로그인 후 받을 수 있어요.{" "}
            <Link href="/artist/login" className="font-semibold text-primary hover:underline">
              로그인
            </Link>
          </p>
        )}
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
    </div>
  );
}
