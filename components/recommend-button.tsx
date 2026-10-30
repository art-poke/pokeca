"use client";

import { ThumbsUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

type State = "download" | "recommend" | null;

// 추천 토글(회원). 이미 다운로드로 반영됐으면 비활성. 비회원은 로그인 유도.
export const RecommendButton = ({
  artworkId,
  initialState,
  initialCount,
  isMember,
}: {
  artworkId: string;
  initialState: State;
  initialCount: number;
  isMember: boolean;
}) => {
  const router = useRouter();
  const [state, setState] = useState<State>(initialState);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const recommended = state === "recommend";
  const blocked = state === "download";

  async function toggle() {
    if (!isMember) {
      setNote("로그인하면 추천할 수 있어요.");
      return;
    }
    if (blocked || pending) return;
    setPending(true);
    setNote(null);
    try {
      const res = await fetch(`/api/artworks/${artworkId}/recommend`, { method: "POST" });
      if (res.status === 401) {
        setNote("로그인하면 추천할 수 있어요.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNote(data.code === "already_downloaded" ? "이미 다운로드로 반영됐어요." : "실패했어요. 다시 시도해 주세요.");
        return;
      }
      const data = (await res.json()) as { recommended: boolean };
      setState(data.recommended ? "recommend" : null);
      setCount((c) => c + (data.recommended ? 1 : -1));
      router.refresh();
    } catch {
      setNote("실패했어요. 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={blocked || pending}
        aria-pressed={recommended}
        className={cn(
          "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors disabled:opacity-60",
          recommended
            ? "border-primary bg-accent text-accent-foreground"
            : "border-border bg-background text-ink-700 hover:bg-gray-50",
        )}
      >
        <ThumbsUp className={cn("size-4", recommended && "fill-current")} />
        추천 {count}
      </button>
      {blocked && <p className="mt-1.5 text-xs text-muted-foreground">다운로드로 이미 반영됐어요.</p>}
      {note && <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
};
