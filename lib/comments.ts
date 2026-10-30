import "server-only";
import { db } from "@/lib/supabase/server";
import { UUID } from "@/lib/uuid";

// 다형 댓글(도안·게시글) + 1단계 대댓글. 작성자 표시명은 작성 시점 스냅샷.
export type CommentTarget = "artwork" | "post";

export class CommentError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export type Comment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  parentId: string | null;
  mine: boolean;
  deleted: boolean;
  replies: Comment[];
};

type Row = {
  id: string;
  user_id: string;
  author_name: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  deleted_at: string | null;
};

export async function listComments(
  target: CommentTarget,
  targetId: string,
  viewerId: string | null,
): Promise<Comment[]> {
  if (!UUID.test(targetId)) return [];
  const { data, error } = await db()
    .from("comments")
    .select("id, user_id, author_name, parent_id, body, created_at, deleted_at")
    .eq("target_type", target)
    .eq("target_id", targetId)
    .order("created_at", { ascending: true })
    .returns<Row[]>();
  if (error) throw error;

  const byId = new Map<string, Comment>();
  for (const r of data) {
    byId.set(r.id, {
      id: r.id,
      authorName: r.author_name,
      body: r.deleted_at ? "삭제된 댓글이에요." : r.body,
      createdAt: r.created_at,
      parentId: r.parent_id,
      mine: !!viewerId && r.user_id === viewerId && !r.deleted_at,
      deleted: !!r.deleted_at,
      replies: [],
    });
  }
  const roots: Comment[] = [];
  for (const r of data) {
    const c = byId.get(r.id)!;
    const parent = r.parent_id ? byId.get(r.parent_id) : null;
    if (parent) parent.replies.push(c);
    else roots.push(c);
  }
  // 전부 삭제됐고 답글도 없는 루트는 숨긴다.
  return roots.filter((c) => !(c.deleted && c.replies.length === 0));
}

export async function createComment(opts: {
  target: CommentTarget;
  targetId: string;
  userId: string;
  authorName: string;
  body: string;
  parentId?: string | null;
}): Promise<void> {
  const body = opts.body.trim();
  if (!body) throw new CommentError("empty");
  if (body.length > 2000) throw new CommentError("too_long");
  if (!UUID.test(opts.targetId)) throw new CommentError("not_found");

  let parentId: string | null = null;
  if (opts.parentId) {
    // 대댓글은 1단계만: 부모는 같은 대상의 루트 댓글이어야 한다.
    const { data, error } = await db()
      .from("comments")
      .select("parent_id, target_type, target_id")
      .eq("id", opts.parentId)
      .maybeSingle<{ parent_id: string | null; target_type: string; target_id: string }>();
    if (error) throw error;
    if (
      !data ||
      data.parent_id !== null ||
      data.target_type !== opts.target ||
      data.target_id !== opts.targetId
    ) {
      throw new CommentError("invalid_parent");
    }
    parentId = opts.parentId;
  }

  const { error } = await db().from("comments").insert({
    target_type: opts.target,
    target_id: opts.targetId,
    user_id: opts.userId,
    author_name: opts.authorName,
    parent_id: parentId,
    body,
  });
  if (error) throw error;
}

// soft delete. 본인 또는 어드민만.
export async function deleteComment(id: string, userId: string, isAdmin: boolean): Promise<void> {
  if (!UUID.test(id)) throw new CommentError("not_found");
  const { data, error } = await db()
    .from("comments")
    .select("user_id, deleted_at")
    .eq("id", id)
    .maybeSingle<{ user_id: string; deleted_at: string | null }>();
  if (error) throw error;
  if (!data) throw new CommentError("not_found");
  if (data.user_id !== userId && !isAdmin) throw new CommentError("forbidden");
  if (data.deleted_at) return;
  const { error: upErr } = await db()
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (upErr) throw upErr;
}

export async function commentCount(target: CommentTarget, targetId: string): Promise<number> {
  if (!UUID.test(targetId)) return 0;
  const { count, error } = await db()
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("target_type", target)
    .eq("target_id", targetId)
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}
