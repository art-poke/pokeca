"use client";

import { useState } from "react";
import type { PublicArtwork } from "@/lib/artworks";
import { ReportDialog } from "./ReportDialog";

// 도안 상세의 "신고·내림 요청" 버튼 + 다이얼로그.
export const ReportTrigger = ({ artwork }: { artwork: PublicArtwork }) => {
  const [open, setOpen] = useState<PublicArtwork | null>(null);
  return (
    <>
      <button
        type="button"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-destructive"
        onClick={() => setOpen(artwork)}
      >
        신고·내림 요청
      </button>
      <ReportDialog artwork={open} onClose={() => setOpen(null)} />
    </>
  );
};
