"use client";

import { ThumbsUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { showLoginNudge } from "@/lib/toast/gr-toast";
import { cn } from "@/lib/utils";
import { useToggleRecommendMutation } from "@/domains/artwork/hooks";

// 추천 토글 버튼. 상태는 훅이 낙관적으로 관리(상세 쿼리 캐시) → 버튼은 훅만 호출한다.
export const RecommendButton = ({
  id,
  isRecommended,
  recommendCount,
  isMember,
}: {
  id: string;
  isRecommended: boolean;
  recommendCount: number;
  isMember: boolean;
}) => {
  const router = useRouter();
  const { mutate, isPending } = useToggleRecommendMutation(id);

  const onClick = () => {
    if (!isMember) {
      showLoginNudge("추천은 로그인 후 이용할 수 있어요", () =>
        router.push("/artist/login"),
      );
      return;
    }
    mutate();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      aria-pressed={isRecommended}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border px-4 text-sm font-semibold transition-colors disabled:opacity-60",
        isRecommended
          ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
          : "border-border bg-background text-ink-700 hover:bg-gray-50",
      )}
    >
      <ThumbsUp className={cn("size-4", isRecommended && "fill-rose-400 text-rose-400")} aria-hidden />
      추천 {recommendCount}
    </button>
  );
};
