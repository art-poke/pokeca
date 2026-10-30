"use client";

import { Megaphone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// 카드단위 도안 요청(회원). 유저당 카드당 1회.
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
  const [note, setNote] = useState<string | null>(null);

  async function request() {
    if (!isMember) {
      setNote("로그인하면 요청할 수 있어요.");
      return;
    }
    if (requested || pending) return;
    setPending(true);
    setNote(null);
    try {
      const res = await fetch(`/api/cards/${cardId}/request`, { method: "POST" });
      if (res.status === 401) {
        setNote("로그인이 필요해요.");
        return;
      }
      if (res.ok) setRequested(true);
      else setNote("요청하지 못했어요.");
    } catch {
      setNote("요청하지 못했어요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={request}
        disabled={requested || pending}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-sm font-semibold text-ink-700 transition-colors hover:border-primary hover:text-primary disabled:opacity-70"
      >
        <Megaphone className="size-4" aria-hidden />
        {requested ? "요청함" : "이 카드 도안 요청"}
      </button>
      {note && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {note}{" "}
          {!isMember && (
            <Link href="/artist/login" className="font-semibold text-primary hover:underline">
              로그인
            </Link>
          )}
        </p>
      )}
    </div>
  );
};
