"use client";

import { ImagePlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { errorMessage, uploadFile } from "@/components/admin/upload";
import { useCreatePostMutation } from "@/domains/community/hooks";
import { isApiError } from "@/lib/api/errors";
import { showErrorToast, showInfoToast, showSuccessToast } from "@/lib/toast/gr-toast";
import { cn } from "@/lib/utils";

type BoardOption = { value: string; label: string };

// 게시글 작성(회원). notice는 어드민만 옵션에 포함된다(서버도 재검증).
// initialBoard = 글쓰기를 누른 탭의 게시판(기본 선택). 이미지 1장 첨부 가능.
export const PostForm = ({ boards, initialBoard }: { boards: BoardOption[]; initialBoard?: string }) => {
  const router = useRouter();
  const [board, setBoard] = useState(
    initialBoard && boards.some((b) => b.value === initialBoard) ? initialBoard : boards[0]?.value ?? "free",
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { mutate, isPending: pending } = useCreatePostMutation();
  const busy = pending || uploading;

  function pickImage(file: File | null) {
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
  }

  function clearImage() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageFile(null);
    setImageUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    if (!title.trim() || !body.trim() || busy) return;
    let imageUploadId: string | undefined;
    if (imageFile) {
      setUploading(true);
      try {
        imageUploadId = await uploadFile("post", imageFile, "/api/member");
      } catch (e) {
        setUploading(false);
        return showErrorToast(errorMessage(e instanceof Error ? e.message : ""));
      }
      setUploading(false);
    }
    mutate(
      { board, title, body, imageUploadId },
      {
        onSuccess: ({ id }) => {
          showSuccessToast("글을 등록했어요");
          router.push(`/community/${id}`);
        },
        onError: (error) => {
          const status = isApiError(error) ? error.status : 0;
          if (status === 401) return showInfoToast("로그인이 필요해요");
          if (status === 403) return showErrorToast("forbidden");
          showErrorToast();
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {boards.map((b) => (
          <button
            key={b.value}
            type="button"
            onClick={() => setBoard(b.value)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              board === b.value
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border text-ink-700 hover:border-gray-300",
            )}
          >
            {b.label}
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        maxLength={120}
        className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-base font-medium text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="내용을 입력하세요"
        rows={10}
        className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />

      {/* 이미지 첨부(선택, 1장) */}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg"
        className="sr-only"
        onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
      />
      {imageUrl ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="첨부 미리보기" className="max-h-64 rounded-xl border border-border object-contain" />
          <button
            type="button"
            onClick={clearImage}
            aria-label="이미지 제거"
            className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/70"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3.5 py-2 text-sm font-medium text-ink-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          <ImagePlus className="size-4" aria-hidden />
          이미지 첨부 (PNG·JPEG)
        </button>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          취소
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !title.trim() || !body.trim()}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-red-700 disabled:opacity-60"
        >
          {uploading ? "이미지 올리는 중…" : pending ? "등록 중…" : "등록"}
        </button>
      </div>
    </div>
  );
};
