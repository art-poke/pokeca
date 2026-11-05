"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUpdateProfileMutation } from "@/domains/member/hooks";
import { isApiError } from "@/lib/api/errors";
import { showErrorMessage, showSuccessToast } from "@/lib/toast/gr-toast";

// 도안 업로드 전 "작가 주소 이름(handle)"을 이 자리에서 바로 설정(마이페이지로 안 튕기게).
// 성공하면 router.refresh()로 상위 게이트가 다시 돌아 업로드 폼이 나타난다.
export function HandleSetup({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const { mutateAsync: updateProfile, isPending } = useUpdateProfileMutation();

  async function save() {
    const h = handle.trim().toLowerCase();
    if (!/^[a-z0-9_]{2,30}$/.test(h)) {
      showErrorMessage("주소 이름은 영문 소문자·숫자·밑줄(_)로 2~30자예요.");
      return;
    }
    try {
      await updateProfile({ displayName, handle: h });
      showSuccessToast("작가 주소 이름을 정했어요");
      router.refresh();
    } catch (e) {
      if (isApiError(e) && e.status === 401) return showErrorMessage("로그인 후 설정할 수 있어요.");
      const code = e instanceof Error ? e.message : "";
      showErrorMessage(code === "handle_taken" ? "이미 쓰는 주소 이름이에요. 다른 이름을 골라 주세요." : "설정하지 못했어요. 다시 시도해 주세요.");
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-border bg-background p-6 text-center">
      <h2 className="font-display text-lg font-bold text-foreground">먼저 작가 주소 이름을 정해 주세요</h2>
      <p className="text-sm text-muted-foreground">
        도안을 올리면 내 작가 페이지(/artists/주소이름)에 모여요. 주소 이름은 영문 소문자·숫자·밑줄(_) 2~30자.
      </p>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">@</span>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value.toLowerCase())}
          maxLength={30}
          placeholder="예: my_art"
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="h-11 flex-1 rounded-lg border border-input bg-background px-3.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </div>
      <button
        type="button"
        onClick={save}
        disabled={isPending || !handle.trim()}
        className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-red-700 disabled:opacity-60"
      >
        <Check className="size-4" aria-hidden />
        {isPending ? "설정 중…" : "정하고 계속하기"}
      </button>
    </div>
  );
}
