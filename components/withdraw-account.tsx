"use client";

import { useRef, useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { withdrawAccount } from "@/app/artist/actions";

const CONFIRM_PHRASE = "탈퇴합니다";

// 마이페이지 하단 회원 탈퇴. 확인 문구를 직접 입력해야 버튼이 켜진다(실수 방지).
// 탈퇴(소프트) 후에는 next-auth signOut으로 세션 쿠키까지 지운다.
export const WithdrawAccount = () => {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const matches = typed.trim() === CONFIRM_PHRASE;

  const confirm = () =>
    start(async () => {
      setError(null);
      const res = await withdrawAccount(typed);
      if (res?.error) {
        setError(res.error);
        return;
      }
      await signOut({ callbackUrl: "/" });
    });

  return (
    <section aria-labelledby="withdraw" className="border-t border-border pt-8">
      <h2 id="withdraw" className="text-sm font-semibold text-muted-foreground">
        회원 탈퇴
      </h2>
      <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
        탈퇴하면 프로필과 연결된 소셜 로그인이 삭제돼요. 올린 도안은{" "}
        <span className="font-medium text-foreground">탈퇴한 작가</span>로 남고, 작가 공개 페이지는 사라져요. 되돌릴 수 없어요.
      </p>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="mt-3 text-xs font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-destructive"
      >
        회원 탈퇴하기
      </button>

      <dialog
        ref={dialog}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-border bg-background p-0 shadow-xl backdrop:bg-black/40"
      >
        <div className="space-y-4 p-6">
          <div>
            <h3 className="text-base font-bold text-foreground">정말 탈퇴할까요?</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              계정을 되돌릴 수 없어요. 확인을 위해 아래에{" "}
              <span className="font-semibold text-foreground">{CONFIRM_PHRASE}</span>를 입력해 주세요.
            </p>
          </div>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            aria-label="확인 문구"
            autoComplete="off"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              disabled={pending}
              className="rounded-xl px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={!matches || pending}
              className="rounded-xl bg-destructive px-3.5 py-2 text-sm font-semibold text-destructive-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "탈퇴 중…" : "탈퇴하기"}
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
};
