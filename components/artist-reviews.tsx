"use client";

import { ImagePlus, MessageSquareHeart, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { errorMessage, uploadFile } from "@/components/admin/upload";
import { REVIEW_MAX } from "@/lib/profile";
import type { Review } from "@/lib/reviews";
import { cn } from "@/lib/utils";

// 작가 후기: 이미지+텍스트. 회원이 작가 공개페이지에서 쓰고, 스튜디오·커뮤니티에도 보인다.
export function ArtistReviews({
  artistHandle,
  reviews,
  canWrite,
  canModerate = false,
  selfNotice,
}: {
  artistHandle: string;
  reviews: Review[];
  canWrite: boolean;
  canModerate?: boolean;
  // 본인(작가)이 자기 페이지를 볼 때 안내문.
  selfNotice?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickImage(file: File | null) {
    if (!file) return;
    if (image) URL.revokeObjectURL(image.url);
    setImage({ file, url: URL.createObjectURL(file) });
  }
  function clearImage() {
    if (image) URL.revokeObjectURL(image.url);
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    if (!body.trim()) {
      toast.error("후기 내용을 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const imageUploadId = image ? await uploadFile("review", image.file, "/api/member") : undefined;
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistHandle, body: body.trim(), imageUploadId }),
      });
      if (res.status === 401) {
        toast("후기는 로그인 후 남길 수 있어요", {
          action: { label: "로그인", onClick: () => router.push("/artist/login") },
        });
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.code ?? "failed");
      toast.success("후기를 남겼어요");
      setBody("");
      clearImage();
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e instanceof Error ? e.message : "", "후기를 남기지 못했어요."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      toast.success("후기를 지웠어요");
      router.refresh();
    } catch {
      toast.error("후기를 지우지 못했어요.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="reviews" className="space-y-4">
      <h2 id="reviews" className="flex items-center gap-2 font-display text-xl font-bold text-foreground">
        <MessageSquareHeart className="size-5 text-primary" aria-hidden />
        작가 후기 {reviews.length}개
      </h2>

      {canWrite && (
        <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={REVIEW_MAX}
            rows={3}
            placeholder="이 작가님 도안을 써 본 후기를 남겨보세요."
            className="w-full resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          {image && (
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="첨부 이미지" className="max-h-48 rounded-xl object-contain" />
              <button
                type="button"
                onClick={clearImage}
                className="absolute right-1.5 top-1.5 inline-flex size-7 items-center justify-center rounded-full bg-background/90 text-ink-600 shadow-sm hover:text-destructive"
                aria-label="이미지 지우기"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-gray-50"
            >
              <ImagePlus className="size-4" aria-hidden />
              {image ? "사진 바꾸기" : "사진 추가"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="inline-flex h-10 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              {saving ? "남기는 중…" : "후기 남기기"}
            </button>
          </div>
        </div>
      )}

      {selfNotice && !canWrite && (
        <p className="rounded-xl bg-accent px-4 py-2.5 text-sm text-accent-foreground">{selfNotice}</p>
      )}

      {reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          아직 후기가 없어요. {canWrite && "첫 후기를 남겨보세요."}
        </div>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
                    {r.authorName[0]}
                  </span>
                  <div className="text-sm">
                    <span className="font-semibold text-foreground">{r.authorName}</span>
                    <span className="tabular ml-2 text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                </div>
                {(r.mine || canModerate) && (
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    disabled={busyId === r.id}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-60",
                    )}
                    aria-label="후기 삭제"
                  >
                    <Trash2 className="size-3.5" />
                    삭제
                  </button>
                )}
              </div>
              <p className="mt-2.5 whitespace-pre-wrap text-sm text-ink-700">{r.body}</p>
              {r.hasImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/reviews/${r.id}/image`}
                  alt="후기 이미지"
                  loading="lazy"
                  className="mt-3 max-h-80 rounded-xl border border-border object-contain"
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
