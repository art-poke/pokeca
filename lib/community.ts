import "server-only";
import { db } from "@/lib/supabase/server";
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

type Row = {
  id: string;
  board: Board;
  title: string;
  author_name: string;
  user_id: string;
  body: string;
  created_at: string;
};

export async function listPosts(board: Board, limit = 50): Promise<PostListItem[]> {
  const { data, error } = await db()
    .from("posts")
    .select("id, board, title, author_name, created_at")
    .eq("board", board)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Omit<Row, "user_id" | "body">[]>();
  if (error) throw error;
  return Promise.all(
    data.map(async (r) => ({
      id: r.id,
      board: r.board,
      title: r.title,
      authorName: r.author_name,
      createdAt: r.created_at,
      comments: await commentCount("post", r.id),
    })),
  );
}

export async function getPost(id: string, viewerId: string | null): Promise<PostDetail | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await db()
    .from("posts")
    .select("id, board, title, author_name, user_id, body, created_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<Row>();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    board: data.board,
    title: data.title,
    authorName: data.author_name,
    createdAt: data.created_at,
    body: data.body,
    comments: await commentCount("post", id),
    mine: !!viewerId && data.user_id === viewerId,
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
  const { data, error } = await db()
    .from("posts")
    .insert({
      board: opts.board,
      user_id: opts.userId,
      author_name: opts.authorName,
      title,
      body,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function deletePost(id: string, userId: string, isAdmin: boolean): Promise<void> {
  if (!UUID.test(id)) throw new PostError("not_found");
  const { data, error } = await db()
    .from("posts")
    .select("user_id, deleted_at")
    .eq("id", id)
    .maybeSingle<{ user_id: string; deleted_at: string | null }>();
  if (error) throw error;
  if (!data) throw new PostError("not_found");
  if (data.user_id !== userId && !isAdmin) throw new PostError("forbidden");
  if (data.deleted_at) return;
  const { error: upErr } = await db()
    .from("posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (upErr) throw upErr;
}
