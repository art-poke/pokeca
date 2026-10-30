import { MessageSquare, PenLine } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { BOARD_LABEL, BOARDS, type Board, isBoard, listPosts } from "@/lib/community";
import { cn } from "@/lib/utils";

export const metadata = { title: "커뮤니티 · 확장 아트 아카이브" };

export default function CommunityPage(props: PageProps<"/community">) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">커뮤니티</h1>
        <Link
          href="/community/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-red-700"
        >
          <PenLine className="size-4" aria-hidden />
          글쓰기
        </Link>
      </header>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-gray-100" />}>
        <Board searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Board({ searchParams }: Pick<PageProps<"/community">, "searchParams">) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.board) ? sp.board[0] : sp.board;
  const board: Board = isBoard(raw) ? raw : "notice";
  const posts = await listPosts(board);

  return (
    <>
      <div className="inline-flex rounded-xl bg-muted p-1">
        {BOARDS.map((b) => (
          <Link
            key={b}
            href={`/community?board=${b}`}
            aria-current={board === b}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
              board === b
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {BOARD_LABEL[b]}
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          아직 글이 없어요. 첫 글을 남겨보세요.
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
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
