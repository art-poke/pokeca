"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

type BoardOption = { value: string; label: string };

// 게시글 작성(회원). notice는 어드민만 옵션에 포함된다(서버도 재검증).
export const PostForm = ({ boards }: { boards: BoardOption[] }) => {
  const router = useRouter();
  const [board, setBoard] = useState(boards[0]?.value ?? "free");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || !body.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board, title, body }),
      });
      if (res.status === 401) {
        setError("로그인이 필요해요.");
        return;
      }
      if (res.status === 403) {
        setError("이 게시판에 쓸 권한이 없어요.");
        return;
      }
      if (!res.ok) {
        setError("등록하지 못했어요.");
        return;
      }
      const { id } = (await res.json()) as { id: string };
      router.push(`/community/${id}`);
    } catch {
      setError("등록하지 못했어요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {boards.map((b) => (
          <button
            key={b.value}
            type="button"
            onClick={() => setBoard(b.value)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              board === b.value
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border text-ink-700 hover:border-gray-300",
            )}
          >
            {b.label}
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        maxLength={120}
        className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-base font-medium text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="내용을 입력하세요"
        rows={10}
        className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <div className="flex items-center justify-end gap-3">
        {error && <span className="mr-auto text-sm text-destructive">{error}</span>}
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          취소
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !title.trim() || !body.trim()}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? "등록 중…" : "등록"}
        </button>
      </div>
    </div>
  );
};
