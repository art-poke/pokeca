"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { editArtwork } from "@/app/artist/actions";
import { errorMessage, uploadFile } from "@/components/admin/upload";
import type { MyArtworkEdit } from "@/lib/artists";

export function ArtworkEditForm({ art }: { art: MyArtworkEdit }) {
  const [state, action, pending] = useActionState(editArtwork, null);
  const [hasSource, setHasSource] = useState(!!art.sourceUrl);
  const [uploadId, setUploadId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imgName, setImgName] = useState("");
  const [imgError, setImgError] = useState("");
  const multi = art.pieceCount > 1;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgError("");
    setUploading(true);
    try {
      const id = await uploadFile("original", file, "/api/artist");
      setUploadId(id);
      setImgName(file.name);
    } catch (err) {
      setImgError(errorMessage(err instanceof Error ? err.message : ""));
      setUploadId("");
      setImgName("");
    } finally {
      setUploading(false);
    }
  }

  const field = "h-11 w-full rounded-lg border border-input bg-background px-3.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={art.id} />
      <input type="hidden" name="originalUploadId" value={uploadId} />

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink-700">제목 <span className="text-muted-foreground">(선택)</span></span>
        <input name="title" defaultValue={art.title} maxLength={80} placeholder="예: 리자몽 풀아트" className={field} />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink-700">작가 표시 이름</span>
        <input name="artistName" defaultValue={art.artistName} maxLength={40} required className={field} />
      </label>

      <div className="space-y-1.5">
        <span className="text-sm font-medium text-ink-700">원본 글 링크 <span className="text-muted-foreground">(선택)</span></span>
        <input
          name="sourceUrl"
          type="url"
          defaultValue={art.sourceUrl ?? ""}
          onChange={(e) => setHasSource(!!e.target.value.trim())}
          placeholder="https://..."
          className={field}
        />
        {hasSource && (
          <select name="sourceVisibility" defaultValue={art.sourceVisibility ?? "public"} className={field}>
            <option value="public">원본 글: 누구나 볼 수 있음</option>
            <option value="members_only">원본 글: 회원만 볼 수 있음</option>
          </select>
        )}
      </div>

      <div className="space-y-1.5 rounded-xl border border-border bg-background p-3.5">
        <span className="text-sm font-medium text-ink-700">이미지 교체 <span className="text-muted-foreground">(선택)</span></span>
        {multi ? (
          <p className="text-sm text-muted-foreground">여러 조각(9포켓 등) 도안은 이미지 교체를 지원하지 않아요. 세부정보만 수정돼요.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">새 이미지를 올리면 기존 이미지가 교체돼요. 안 올리면 그대로예요.</p>
            <input type="file" accept="image/png,image/jpeg,application/pdf" onChange={onPick} className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-semibold" />
            {uploading && <p className="text-sm text-muted-foreground">올리는 중…</p>}
            {uploadId && <p className="text-sm text-green-700">새 이미지 준비됨: {imgName}</p>}
            {imgError && <p className="text-sm text-destructive">{imgError}</p>}
          </>
        )}
      </div>

      <div role="status">{state?.error && <p className="text-sm text-destructive">{state.error}</p>}</div>

      <div className="flex items-center justify-end gap-2">
        <Link href="/me" className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          취소
        </Link>
        <button
          type="submit"
          disabled={pending || uploading}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}
