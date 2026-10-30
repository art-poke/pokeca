import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Comments } from "@/components/comments";
import { PostDeleteButton } from "@/components/post-delete-button";
import { Badge } from "@/components/ui/badge";
import { currentAdmin } from "@/lib/admin";
import { listComments } from "@/lib/comments";
import { BOARD_LABEL, getPost } from "@/lib/community";
import { currentMember } from "@/lib/members";

export default function PostPage(props: PageProps<"/community/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-gray-100" />}>
      <Post params={props.params} />
    </Suspense>
  );
}

async function Post({ params }: Pick<PageProps<"/community/[id]">, "params">) {
  const { id } = await params;
  const member = await currentMember();
  const post = await getPost(id, member?.userId ?? null);
  if (!post) notFound();

  const [isAdmin, comments] = await Promise.all([
    currentAdmin().then((a) => !!a),
    listComments("post", id, member?.userId ?? null),
  ]);
  const canDelete = post.mine || isAdmin;

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/community?board=${post.board}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {BOARD_LABEL[post.board]}
      </Link>

      <header className="space-y-2 border-b border-border pb-5">
        <Badge variant={post.board === "notice" ? "primary" : "soft"}>
          {BOARD_LABEL[post.board]}
        </Badge>
        <h1 className="font-display text-2xl font-bold text-foreground">{post.title}</h1>
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {post.authorName} · {new Date(post.createdAt).toLocaleDateString("ko-KR")}
          </span>
          {canDelete && <PostDeleteButton postId={post.id} board={post.board} />}
        </div>
      </header>

      <div className="whitespace-pre-wrap break-words text-ink-800">{post.body}</div>

      <div className="border-t border-border pt-6">
        <Comments target="post" targetId={id} comments={comments} canWrite={!!member} />
      </div>
    </article>
  );
}
