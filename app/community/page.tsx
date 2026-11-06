import { MessageSquare, PenLine } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CommunityTabs } from "@/components/community-tabs";
import { RowsSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { type Board, isBoard, listPosts } from "@/lib/community";

export const metadata = { title: "커뮤니티 · Extended Art Archive" };

export default async function CommunityPage(props: PageProps<"/community">) {
  // 현재 탭을 글쓰기 링크에 실어, 글쓰기 폼이 그 게시판으로 열리게 한다.
  const sp = await props.searchParams;
  const raw = Array.isArray(sp.board) ? sp.board[0] : sp.board;
  const board: Board = isBoard(raw) ? raw : "free";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">커뮤니티</h1>
        <Link
          href={`/community/new?board=${board}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-red-700"
        >
          <PenLine className="size-4" aria-hidden />
          글쓰기
        </Link>
      </header>
      <Suspense
        key={board}
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-10 w-72 rounded-xl" />
            <RowsSkeleton />
          </div>
        }
      >
        <Board board={board} />
      </Suspense>
    </div>
  );
}

async function Board({ board }: { board: Board }) {
  const posts = await listPosts(board);

  return (
    <>
      <CommunityTabs active={board} />

      {posts.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          아직 글이 없어요. 첫 글을 남겨보세요.
        </div>
      ) : (
        <ul className="enter mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/community/${p.id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-foreground">{p.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {p.authorName} · {new Date(p.createdAt).toLocaleDateString("ko-KR")}
                  </div>
                </div>
                {p.comments > 0 && (
                  <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                    <MessageSquare className="size-4" aria-hidden />
                    {p.comments}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
