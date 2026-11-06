"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTransition } from "react";
import { setVisibility } from "../actions";

// 내 도안 공개/비공개 토글. active=공개, hidden=비공개(본인만 봄).
export function VisibilityToggle({ id, status }: { id: string; status: "active" | "hidden" }) {
  const [pending, start] = useTransition();
  const isPublic = status === "active";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setVisibility(id, !isPublic))}
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      aria-label={isPublic ? "비공개로 바꾸기" : "공개로 바꾸기"}
    >
      {isPublic ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
      {pending ? "변경 중…" : isPublic ? "공개중" : "비공개"}
    </button>
  );
}
