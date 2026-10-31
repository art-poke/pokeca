import { Suspense } from "react";
import { PostForm } from "@/components/post-form";
import { currentAdmin } from "@/lib/admin";
import { BOARD_LABEL } from "@/lib/community";
import { requireMember } from "@/lib/members";

export const metadata = { title: "글쓰기 · 커뮤니티" };

export default function NewPostPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-gray-100" />}>
      <New />
    </Suspense>
  );
}

async function New() {
  await requireMember(); // 비로그인 → /artist/login
  const isAdmin = !!(await currentAdmin());
  const boards = [
    ...(isAdmin ? [{ value: "notice", label: BOARD_LABEL.notice }] : []),
    { value: "suggestion", label: BOARD_LABEL.suggestion },
    { value: "free", label: BOARD_LABEL.free },
  ];
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">글쓰기</h1>
      <PostForm boards={boards} />
    </div>
  );
}
