"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// 카드 즐겨찾기 토글. 회원만(비회원은 토스트로 로그인 안내). 상태는 낙관적으로 바꾸고 실패 시 되돌린다.
export function FavoriteButton({
  cardId,
  isMember,
  initial,
}: {
  cardId: string;
  isMember: boolean;
  initial: boolean;
}) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!isMember) {
      toast("즐겨찾기는 로그인 후 쓸 수 있어요", {
        action: { label: "로그인", onClick: () => router.push("/artist/login") },
      });
      return;
    }
    setBusy(true);
    const next = !favorited;
    setFavorited(next); // 낙관적
    try {
      const res = await fetch("/api/member/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });
      if (res.status === 401) {
        setFavorited(!next);
        toast("즐겨찾기는 로그인 후 쓸 수 있어요", {
          action: { label: "로그인", onClick: () => router.push("/artist/login") },
        });
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const { favorited: now } = await res.json();
      setFavorited(now);
      toast.success(now ? "즐겨찾기에 담았어요" : "즐겨찾기에서 뺐어요");
      router.refresh();
    } catch {
      setFavorited(!next);
      toast.error("즐겨찾기를 바꾸지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={favorited}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border px-4 text-sm font-semibold transition-colors disabled:opacity-60",
        favorited
          ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
          : "border-border bg-background text-ink-700 hover:bg-gray-50",
      )}
    >
      <Star className={cn("size-4", favorited && "fill-amber-400 text-amber-400")} aria-hidden />
      {favorited ? "즐겨찾기됨" : "즐겨찾기"}
    </button>
  );
}
