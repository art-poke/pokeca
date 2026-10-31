"use client";

import { Megaphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// 카드단위 도안 요청(회원). 피드백은 toast. 유저당 카드당 1회.
export const RequestArtButton = ({
  cardId,
  isMember,
  requested: initialRequested,
}: {
  cardId: string;
  isMember: boolean;
  requested: boolean;
}) => {
  const [requested, setRequested] = useState(initialRequested);
  const [pending, setPending] = useState(false);

  async function request() {
    if (!isMember) {
      toast("로그인하면 요청할 수 있어요", {
        action: { label: "로그인", onClick: () => (window.location.href = "/artist/login") },
      });
      return;
    }
    if (requested || pending) return;
    setPending(true);
    try {
      const res = await fetch(`/api/cards/${cardId}/request`, { method: "POST" });
      if (res.status === 401) {
        toast("로그인이 필요해요");
        return;
      }
      if (res.ok) {
        setRequested(true);
        toast.success("도안을 요청했어요");
      } else {
        toast.error("요청하지 못했어요");
      }
    } catch {
      toast.error("요청하지 못했어요");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={request}
      disabled={requested || pending}
      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-sm font-semibold text-ink-700 transition-colors hover:border-primary hover:text-primary disabled:opacity-70"
    >
      <Megaphone className="size-4" aria-hidden />
      {requested ? "요청함" : "이 카드 도안 요청"}
    </button>
  );
};
