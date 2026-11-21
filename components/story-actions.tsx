"use client";

import { Heart, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStoryLikeMutation } from "@/domains/story/hooks";
import { isApiError } from "@/lib/api/errors";
import { showErrorMessage, showErrorToast, showLoginNudge, showSuccessToast } from "@/lib/toast/gr-toast";
import { cn } from "@/lib/utils";

const actionClass = "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-60";

export function StoryLikeButton({
  slug,
  isMember,
  initial,
}: {
  slug: string;
  isMember: boolean;
  initial: { liked: boolean; count: number };
}) {
  const router = useRouter();
  const { data, mutate, isPending } = useStoryLikeMutation(slug);
  const { liked, count } = data ?? initial;
  const nudge = () => showLoginNudge("로그인하면 좋아요를 누를 수 있어요", () => router.push("/artist/login"));

  function toggle() {
    if (!isMember) return nudge();
    mutate(!liked, {
      onError: (error) => {
        if (isApiError(error) && error.status === 401) return nudge();
        showErrorToast(isApiError(error) ? error.code ?? undefined : undefined);
      },
    });
  }

  return (
    <button type="button" aria-pressed={liked} disabled={isPending} onClick={toggle}
      className={cn(actionClass, liked && "border-primary text-primary")}>
      <Heart className={cn("size-4", liked && "fill-current")} aria-hidden />
      좋아요 {count}
    </button>
  );
}

export function StoryShareButton({ title, path }: { title: string; path: string }) {
  const [manualLink, setManualLink] = useState<string>();

  async function share() {
    const url = new URL(path, window.location.origin).href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showSuccessToast("링크를 복사했어요");
    } catch {
      setManualLink(url);
      showErrorMessage("자동 복사가 되지 않아 링크를 표시했어요");
    }
  }

  return (
    <>
      <button type="button" onClick={share} className={actionClass}>
        <Share2 className="size-4" aria-hidden />
        공유하기
      </button>
      {manualLink && (
        <input
          aria-label="공유 링크"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          onFocus={(event) => event.currentTarget.select()}
          readOnly
          value={manualLink}
        />
      )}
    </>
  );
}
