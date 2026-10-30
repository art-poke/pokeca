"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { PublicArtwork } from "@/lib/artworks";
import { FORMAT_INFO } from "@/lib/formats";
import { ArtistName, DownloadAction, SourceLink } from "./ArtworkItem";

// 도안 크게 보기. 네이티브 <dialog>라 포커스 가두기와 Esc 닫기를 브라우저가 처리한다. 바깥을 눌러도 닫힌다.
export function ArtworkViewer({
  artwork,
  onClose,
}: {
  artwork: PublicArtwork | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (artwork && !dialog.open) dialog.showModal();
    if (!artwork && dialog.open) dialog.close();
  }, [artwork]);

  const label = artwork ? FORMAT_INFO[artwork.format].label : "";
  return (
    <dialog
      ref={ref}
      className="w-[92vw] max-w-4xl rounded-2xl bg-transparent p-0 backdrop:bg-ink-900/70 backdrop:backdrop-blur-sm"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      aria-labelledby="viewer-title"
    >
      {artwork && (
        <div className="relative grid overflow-hidden rounded-2xl bg-background md:grid-cols-[1fr_18rem]">
          <div className="flex items-center justify-center bg-ink-900 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/thumbnails/${artwork.id}`}
              alt={`@${artwork.artistName}의 ${label} 확장 아트 도안`}
              className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain"
            />
          </div>
          <div className="flex flex-col gap-3 p-5">
            <h2 id="viewer-title" className="flex items-center gap-1.5 text-base font-bold">
              <ArtistName artwork={artwork} />
              <span className="text-muted-foreground">· {label}</span>
            </h2>
            <p className="text-sm text-muted-foreground">{FORMAT_INFO[artwork.format].printSize}</p>
            <SourceLink artwork={artwork} />
            <div className="mt-auto">
              <DownloadAction key={artwork.id} artwork={artwork} />
            </div>
          </div>
          <button
            type="button"
            className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-background/90 text-ink-700 shadow-sm transition-colors hover:bg-background"
            onClick={() => ref.current?.close()}
            aria-label="크게 보기 닫기"
          >
            <X className="size-5" />
          </button>
        </div>
      )}
    </dialog>
  );
}
