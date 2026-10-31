"use client";

import { Megaphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FORMAT_INFO, type Format } from "@/lib/formats";

// 도안이 없는 규격만 요청 버튼으로 보여준다. 회원 규격별 요청(피드백은 toast).
export const RequestArtButton = ({
  cardId,
  isMember,
  missingFormats,
  requestedFormats,
}: {
  cardId: string;
  isMember: boolean;
  missingFormats: Format[];
  requestedFormats: Format[];
}) => {
  const [requested, setRequested] = useState<Format[]>(requestedFormats);
  const [pending, setPending] = useState<Format | null>(null);

  if (missingFormats.length === 0) return null;

  async function request(format: Format) {
    if (!isMember) {
      toast("로그인하면 요청할 수 있어요", {
        action: { label: "로그인", onClick: () => (window.location.href = "/artist/login") },
      });
      return;
    }
    if (requested.includes(format) || pending) return;
    setPending(format);
    try {
      const res = await fetch(`/api/cards/${cardId}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      if (res.status === 401) {
        toast("로그인이 필요해요");
        return;
      }
      if (res.ok) {
        setRequested((r) => [...r, format]);
        toast.success(`${FORMAT_INFO[format].label} 도안을 요청했어요`);
      } else {
        toast.error("요청하지 못했어요");
      }
    } catch {
      toast.error("요청하지 못했어요");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
        <Megaphone className="size-4" aria-hidden />
        없는 규격 요청:
      </span>
      {missingFormats.map((f) => {
        const done = requested.includes(f);
        return (
          <button
            key={f}
            type="button"
            onClick={() => request(f)}
            disabled={done || pending === f}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold text-ink-700 transition-colors hover:border-primary hover:text-primary disabled:opacity-70"
          >
            {FORMAT_INFO[f].label} {done ? "요청함" : "요청"}
          </button>
        );
      })}
    </div>
  );
};
