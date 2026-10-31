"use client";

import { useActionState, useRef, useState } from "react";
import { withdraw } from "../actions";

// 내 도안 내리기. 파일이 지워져 되돌릴 수 없으므로 카드 번호를 그대로 입력해야 버튼이 켜진다.
export function WithdrawMine({ id, cardLabel }: { id: string; cardLabel: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [state, action, pending] = useActionState(withdraw, null);
  const matches = typed.trim().replace(/\s+/g, " ").toLowerCase() === cardLabel.toLowerCase();

  return (
    <>
      <button
        type="button"
        className="text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
        onClick={() => dialog.current?.showModal()}
      >
        내리기
      </button>
      <dialog
        ref={dialog}
        className="w-[92vw] max-w-md rounded-2xl bg-background p-6 shadow-md backdrop:bg-ink-900/60"
        aria-labelledby={`withdraw-${id}`}
      >
        <form action={action} className="space-y-3">
          <h2 id={`withdraw-${id}`} className="font-display text-lg font-bold text-foreground">
            {cardLabel} 도안 내리기
          </h2>
          <p className="text-sm text-muted-foreground">
            파일이 삭제되며 되돌릴 수 없어요. 다시 공개하려면 새로 올려야 해요.
          </p>
          <input type="hidden" name="id" value={id} />
          <label className="block space-y-1.5">
            <span className="text-sm text-ink-700">
              확인을 위해 <span className="tabular font-semibold">{cardLabel}</span>를 입력하세요
            </span>
            <input
              name="confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="h-11 w-full rounded-lg border border-input bg-background px-3.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </label>
          <div role="status">
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => dialog.current?.close()}
            >
              취소
            </button>
            <button
              type="submit"
              className="rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-red-700 disabled:opacity-50"
              disabled={!matches || pending}
            >
              {pending ? "내리는 중…" : "내리기"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
