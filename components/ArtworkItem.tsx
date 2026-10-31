"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
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

const NOTICE_KEY = "print-notice-shown";

// 다운로드(회원 전용). 피드백·인쇄안내는 toast.
export function DownloadAction({ artwork }: { artwork: PublicArtwork }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function printNotice() {
    let shown = false;
    try {
      shown = sessionStorage.getItem(NOTICE_KEY) === "1";
      sessionStorage.setItem(NOTICE_KEY, "1");
    } catch {}
    if (shown) return;
    const printSize = FORMAT_INFO[artwork.format].printSize;
    const how =
      artwork.printSizeVerified && printSize
        ? `이 파일은 ${printSize}로 확인됐어요.`
        : artwork.sourceUrl
          ? "작가 원본 글의 인쇄 안내도 확인하세요."
          : `${FORMAT_INFO[artwork.format].label} 규격에 맞춰 인쇄하세요.`;
    toast.message("인쇄 안내", {
      description: `‘실제 크기(100%)’로, ‘페이지에 맞추기’는 꺼주세요. ${how}`,
      duration: 8000,
    });
  }

  async function download() {
    setLoading(true);
    try {
      const res = await fetch(`/api/download/${artwork.id}`, { method: "POST" });
      if (res.status === 401) {
        toast("다운로드는 로그인 후 받을 수 있어요", {
          action: { label: "로그인", onClick: () => (window.location.href = "/artist/login") },
        });
        return;
      }
      if (res.status === 410 || res.status === 404) {
        toast.error("이 도안은 더 이상 제공되지 않아요");
        router.refresh();
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const a = document.createElement("a");
      let revoke: string | null = null;
      if (res.headers.get("content-type")?.includes("application/json")) {
        // 단일 조각: 서명 URL로.
        const { url } = await res.json();
        a.href = url;
      } else {
        // 여러 조각: ZIP 바이트를 blob으로 받아 내려받는다.
        const blob = await res.blob();
        revoke = URL.createObjectURL(blob);
        a.href = revoke;
        a.download = decodeURIComponent(res.headers.get("X-Download-Filename") ?? "도안.zip");
      }
      a.rel = "noopener";
      document.body.append(a);
      a.click();
      a.remove();
      if (revoke) URL.revokeObjectURL(revoke);
      router.refresh();
      printNotice();
    } catch {
      toast.error("파일을 준비하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-red-700 disabled:opacity-60"
      onClick={download}
      disabled={loading}
    >
      <Download className="size-4" aria-hidden />
      {loading ? "준비 중…" : "다운로드"}
    </button>
  );
}
