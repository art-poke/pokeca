import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { UUID } from "@/lib/uuid";
import { commentCount } from "@/lib/comments";

// 커뮤니티 게시판. 공지=어드민만 작성, 건의·자유=회원 작성. 누구나 읽기·댓글.
// 탭·기본 노출 순서: 자유게시판을 가장 먼저.
export const BOARDS = ["free", "suggestion", "notice"] as const;
export type Board = (typeof BOARDS)[number];
export const BOARD_LABEL: Record<Board, string> = {
  free: "자유게시판",
  suggestion: "건의사항",
  notice: "공지사항",
};

export class PostError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export function isBoard(v: unknown): v is Board {
  return typeof v === "string" && (BOARDS as readonly string[]).includes(v);
}

export type PostListItem = {
  id: string;
  board: Board;
  title: string;
  authorName: string;
  createdAt: string;
  comments: number;
};

export type PostDetail = PostListItem & { body: string; mine: boolean };

export async function listPosts(board: Board, limit = 50): Promise<PostListItem[]> {
  const data = await db
    .select({
      id: posts.id,
      board: posts.board,
      title: posts.title,
      authorName: posts.authorName,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(and(eq(posts.board, board), isNull(posts.deletedAt)))
    .orderBy(desc(posts.createdAt))
    .limit(limit);
  return Promise.all(
    data.map(async (r) => ({
      id: r.id,
      board: r.board as Board,
      title: r.title,
      authorName: r.authorName,
      createdAt: r.createdAt.toISOString(),
      comments: await commentCount("post", r.id),
    })),
  );
}

export async function getPost(id: string, viewerId: string | null): Promise<PostDetail | null> {
  if (!UUID.test(id)) return null;
  const rows = await db
    .select({
      id: posts.id,
      board: posts.board,
      title: posts.title,
      authorName: posts.authorName,
      userId: posts.userId,
      body: posts.body,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
    .limit(1);
  const data = rows[0] ?? null;
  if (!data) return null;
  return {
    id: data.id,
    board: data.board as Board,
    title: data.title,
    authorName: data.authorName,
    createdAt: data.createdAt.toISOString(),
    body: data.body,
    comments: await commentCount("post", id),
    mine: !!viewerId && data.userId === viewerId,
  };
}

export async function createPost(opts: {
  board: Board;
  userId: string;
  authorName: string;
  title: string;
  body: string;
  isAdmin: boolean;
}): Promise<string> {
  if (!isBoard(opts.board)) throw new PostError("invalid_board");
  if (opts.board === "notice" && !opts.isAdmin) throw new PostError("forbidden");
  const title = opts.title.trim();
  const body = opts.body.trim();
  if (!title || title.length > 120) throw new PostError("invalid_title");
  if (!body || body.length > 20000) throw new PostError("invalid_body");
  const inserted = await db
    .insert(posts)
    .values({
      board: opts.board,
      userId: opts.userId,
      authorName: opts.authorName,
      title,
      body,
    })
    .returning({ id: posts.id });
  return inserted[0].id;
}

export async function deletePost(id: string, userId: string, isAdmin: boolean): Promise<void> {
  if (!UUID.test(id)) throw new PostError("not_found");
  const rows = await db
    .select({ userId: posts.userId, deletedAt: posts.deletedAt })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  const data = rows[0] ?? null;
  if (!data) throw new PostError("not_found");
  if (data.userId !== userId && !isAdmin) throw new PostError("forbidden");
  if (data.deletedAt) return;
  await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, id));
}
