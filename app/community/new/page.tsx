import { Suspense } from "react";
import { PostForm } from "@/components/post-form";
import { currentAdmin } from "@/lib/admin";
import { BOARD_LABEL, isBoard } from "@/lib/community";
import { requireMember } from "@/lib/artists";

export const metadata = { title: "글쓰기 · 커뮤니티" };

export default function NewPostPage(props: PageProps<"/community/new">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-gray-100" />}>
      <New searchParams={props.searchParams} />
    </Suspense>
  );
}

async function New({ searchParams }: Pick<PageProps<"/community/new">, "searchParams">) {
  await requireMember(); // 비로그인 → /artist/login
  const isAdmin = !!(await currentAdmin());
  const boards = [
    ...(isAdmin ? [{ value: "notice", label: BOARD_LABEL.notice }] : []),
    { value: "suggestion", label: BOARD_LABEL.suggestion },
    { value: "free", label: BOARD_LABEL.free },
  ];
  // 어느 탭에서 글쓰기를 눌렀는지(?board=)를 기본 선택으로. notice는 어드민만.
  const sp = await searchParams;
  const raw = Array.isArray(sp.board) ? sp.board[0] : sp.board;
  const initialBoard = isBoard(raw) && boards.some((b) => b.value === raw) ? raw : "free";
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">글쓰기</h1>
      <PostForm boards={boards} initialBoard={initialBoard} />
    </div>
  );
}
