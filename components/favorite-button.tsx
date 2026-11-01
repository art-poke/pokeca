"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToggleFavoriteMutation } from "@/domains/favorite/hooks";
import { isApiError } from "@/lib/api/errors";
import {
  showErrorToast,
  showLoginNudge,
  showSuccessToast,
} from "@/lib/toast/gr-toast";
import { cn } from "@/lib/utils";

// 카드 즐겨찾기 토글. 회원만(비회원은 로그인 안내). 상태는 낙관적으로 바꾸고 실패 시 되돌린다.
// 데이터 접근은 favorite 도메인 훅 경유(raw fetch 제거).
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
  const { mutate, isPending } = useToggleFavoriteMutation();

  const nudge = () =>
    showLoginNudge("즐겨찾기는 로그인 후 쓸 수 있어요", () =>
      router.push("/artist/login"),
    );

  function toggle() {
    if (!isMember) {
      nudge();
      return;
    }
    const next = !favorited;
    setFavorited(next); // 낙관적
    mutate(cardId, {
      onSuccess: (result) => {
        setFavorited(result.favorited);
        showSuccessToast(
          result.favorited ? "즐겨찾기에 담았어요" : "즐겨찾기에서 뺐어요",
        );
        router.refresh();
      },
      onError: (error) => {
        setFavorited(!next); // 롤백
        if (isApiError(error) && error.status === 401) return nudge();
        showErrorToast(isApiError(error) ? error.code ?? undefined : undefined);
      },
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
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
