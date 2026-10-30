"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type CommentNode = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  parentId: string | null;
  mine: boolean;
  deleted: boolean;
  replies: CommentNode[];
};

type Target = "artwork" | "post";

export const Comments = ({
  target,
  targetId,
  comments,
  canWrite,
}: {
  target: Target;
  targetId: string;
  comments: CommentNode[];
  canWrite: boolean;
}) => {
  const total = comments.reduce((n, c) => n + 1 + c.replies.length, 0);
  return (
    <section aria-labelledby="comments-heading" className="space-y-4">
      <h2 id="comments-heading" className="font-display text-lg font-bold text-foreground">
        댓글 {total}
      </h2>
      {canWrite ? (
        <CommentForm target={target} targetId={targetId} />
      ) : (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          댓글을 쓰려면 로그인하세요.
        </p>
      )}
      <ul className="space-y-4">
        {comments.map((c) => (
          <li key={c.id}>
            <CommentRow comment={c} target={target} targetId={targetId} canWrite={canWrite} />
            {c.replies.length > 0 && (
              <ul className="mt-3 space-y-3 border-l-2 border-border pl-4">
                {c.replies.map((r) => (
                  <li key={r.id}>
                    <CommentRow comment={r} target={target} targetId={targetId} canWrite={false} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {comments.length === 0 && (
          <li className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            첫 댓글을 남겨보세요.
          </li>
        )}
      </ul>
    </section>
  );
};

const CommentRow = ({
  comment,
  target,
  targetId,
  canWrite,
}: {
  comment: CommentNode;
  target: Target;
  targetId: string;
  canWrite: boolean;
}) => {
  const router = useRouter();
  const [replying, setReplying] = useState(false);

  async function remove() {
    const res = await fetch(`/api/comments/${comment.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <div className={cn("rounded-xl border border-border bg-background p-3.5", comment.deleted && "opacity-60")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{comment.authorName}</span>
        <span className="text-xs text-muted-foreground">{formatTime(comment.createdAt)}</span>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-ink-700">{comment.body}</p>
      {!comment.deleted && (
        <div className="mt-2 flex items-center gap-3 text-xs">
          {canWrite && !comment.parentId && (
            <button
              type="button"
              className="font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setReplying((v) => !v)}
            >
              답글
            </button>
          )}
          {comment.mine && (
            <button type="button" className="font-medium text-muted-foreground hover:text-destructive" onClick={remove}>
              삭제
            </button>
          )}
        </div>
      )}
      {replying && (
        <div className="mt-3">
          <CommentForm target={target} targetId={targetId} parentId={comment.id} onDone={() => setReplying(false)} />
        </div>
      )}
    </div>
  );
};

const CommentForm = ({
  target,
  targetId,
  parentId,
  onDone,
}: {
  target: Target;
  targetId: string;
  parentId?: string;
  onDone?: () => void;
}) => {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const text = body.trim();
    if (!text || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, targetId, body: text, parentId }),
      });
      if (res.status === 401) {
        setError("로그인이 필요해요.");
        return;
      }
      if (!res.ok) {
        setError("등록하지 못했어요.");
        return;
      }
      setBody("");
      onDone?.();
      router.refresh();
    } catch {
      setError("등록하지 못했어요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentId ? "답글을 입력하세요" : "댓글을 입력하세요"}
        rows={parentId ? 2 : 3}
        className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        {error && <span className="mr-auto text-xs text-destructive">{error}</span>}
        {parentId && (
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            onClick={() => onDone?.()}
          >
            취소
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending || !body.trim()}
          className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? "등록 중…" : "등록"}
        </button>
      </div>
    </div>
  );
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
