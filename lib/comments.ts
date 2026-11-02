import "server-only";
import { and, asc, count, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { comments } from "@/lib/db/schema";
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

export async function listComments(
  target: CommentTarget,
  targetId: string,
  viewerId: string | null,
): Promise<Comment[]> {
  if (!UUID.test(targetId)) return [];
  const data = await db
    .select({
      id: comments.id,
      userId: comments.userId,
      authorName: comments.authorName,
      parentId: comments.parentId,
      body: comments.body,
      createdAt: comments.createdAt,
      deletedAt: comments.deletedAt,
    })
    .from(comments)
    .where(and(eq(comments.targetType, target), eq(comments.targetId, targetId)))
    .orderBy(asc(comments.createdAt));

  const byId = new Map<string, Comment>();
  for (const r of data) {
    byId.set(r.id, {
      id: r.id,
      authorName: r.authorName,
      body: r.deletedAt ? "삭제된 댓글이에요." : r.body,
      createdAt: r.createdAt.toISOString(),
      parentId: r.parentId,
      mine: !!viewerId && r.userId === viewerId && !r.deletedAt,
      deleted: !!r.deletedAt,
      replies: [],
    });
  }
  const roots: Comment[] = [];
  for (const r of data) {
    const c = byId.get(r.id)!;
    const parent = r.parentId ? byId.get(r.parentId) : null;
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
    const rows = await db
      .select({
        parentId: comments.parentId,
        targetType: comments.targetType,
        targetId: comments.targetId,
      })
      .from(comments)
      .where(eq(comments.id, opts.parentId))
      .limit(1);
    const data = rows[0] ?? null;
    if (
      !data ||
      data.parentId !== null ||
      data.targetType !== opts.target ||
      data.targetId !== opts.targetId
    ) {
      throw new CommentError("invalid_parent");
    }
    parentId = opts.parentId;
  }

  await db.insert(comments).values({
    targetType: opts.target,
    targetId: opts.targetId,
    userId: opts.userId,
    authorName: opts.authorName,
    parentId,
    body,
  });
}

// soft delete. 본인 또는 어드민만.
export async function deleteComment(id: string, userId: string, isAdmin: boolean): Promise<void> {
  if (!UUID.test(id)) throw new CommentError("not_found");
  const rows = await db
    .select({ userId: comments.userId, deletedAt: comments.deletedAt })
    .from(comments)
    .where(eq(comments.id, id))
    .limit(1);
  const data = rows[0] ?? null;
  if (!data) throw new CommentError("not_found");
  if (data.userId !== userId && !isAdmin) throw new CommentError("forbidden");
  if (data.deletedAt) return;
  await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, id));
}

export async function commentCount(target: CommentTarget, targetId: string): Promise<number> {
  if (!UUID.test(targetId)) return 0;
  const rows = await db
    .select({ n: count() })
    .from(comments)
    .where(
      and(
        eq(comments.targetType, target),
        eq(comments.targetId, targetId),
        isNull(comments.deletedAt),
      ),
    );
  return rows[0]?.n ?? 0;
}
