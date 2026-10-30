"use client";

import { useEffect, useRef } from "react";
import type { PublicArtwork } from "@/lib/artworks";
import { FORMAT_INFO } from "@/lib/formats";
import { ReportForm } from "./ReportForm";

// 작품 ··· 메뉴의 "신고·내림 요청" 대화상자. 작품 ID는 자동으로 붙는다.
// 네이티브 <dialog>라 포커스 가두기와 Esc 닫기를 브라우저가 처리한다.
export function ReportDialog({
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

  return (
    <dialog
      ref={ref}
      className="w-[92vw] max-w-md rounded-2xl bg-background p-6 shadow-md backdrop:bg-ink-900/60 backdrop:backdrop-blur-sm"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      aria-labelledby="report-title"
    >
      {artwork && (
        <>
          <h2 id="report-title" className="font-display text-lg font-bold text-foreground">
            신고·내림 요청
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            @{artwork.artistName} · {FORMAT_INFO[artwork.format].label}
          </p>
          <div className="mt-4">
            <ReportForm key={artwork.id} artworkId={artwork.id} onDone={onClose} />
          </div>
        </>
      )}
    </dialog>
  );
}
