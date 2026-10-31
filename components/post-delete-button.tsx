"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export const PostDeleteButton = ({ postId, board }: { postId: string; board: string }) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    if (pending) return;
    if (!confirm("이 글을 삭제할까요?")) return;
    setPending(true);
    const res = await fetch(`/api/community/posts/${postId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("글을 삭제했어요");
      router.push(`/community?board=${board}`);
      router.refresh();
    } else {
      toast.error("삭제하지 못했어요");
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      className="text-sm font-medium text-muted-foreground transition-colors hover:text-destructive"
    >
      삭제
    </button>
  );
};
