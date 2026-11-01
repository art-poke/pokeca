"use client";

import { ThumbsUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRecommendArtworkMutation } from "@/domains/artwork/hooks";
import { isApiError } from "@/lib/api/errors";
import {
  showErrorToast,
  showInfoToast,
  showLoginNudge,
  showSuccessToast,
} from "@/lib/toast/gr-toast";
import { cn } from "@/lib/utils";

type State = "download" | "recommend" | null;

// 추천 토글(회원). 피드백은 toast. 이미 다운로드로 반영됐으면 비활성.
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
  const { mutate, isPending: pending } = useRecommendArtworkMutation(artworkId);

  const recommended = state === "recommend";
  const blocked = state === "download";

  function toggle() {
    if (!isMember) {
      showLoginNudge("로그인하면 추천할 수 있어요", () => router.push("/artist/login"));
      return;
    }
    if (blocked) {
      showInfoToast("이미 다운로드로 추천이 반영됐어요");
      return;
    }
    if (pending) return;
    mutate(undefined, {
      onSuccess: (data) => {
        setState(data.recommended ? "recommend" : null);
        setCount((c) => c + (data.recommended ? 1 : -1));
        showSuccessToast(data.recommended ? "추천했어요" : "추천을 취소했어요");
        router.refresh();
      },
      onError: (error) => {
        if (isApiError(error) && error.status === 401) {
          showInfoToast("로그인하면 추천할 수 있어요");
          return;
        }
        showErrorToast(isApiError(error) ? error.code ?? undefined : undefined);
      },
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
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
  );
};
