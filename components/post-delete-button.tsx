"use client";

import { useRouter } from "next/navigation";
import { useDeletePostMutation } from "@/domains/community/hooks";
import { showErrorToast, showSuccessToast } from "@/lib/toast/gr-toast";

export const PostDeleteButton = ({ postId, board }: { postId: string; board: string }) => {
  const router = useRouter();
  const { mutate, isPending: pending } = useDeletePostMutation();

  function remove() {
    if (pending) return;
    if (!confirm("이 글을 삭제할까요?")) return;
    mutate(postId, {
      onSuccess: () => {
        showSuccessToast("글을 삭제했어요");
        router.push(`/community?board=${board}`);
        router.refresh();
      },
      onError: () => showErrorToast(),
    });
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
