"use client";

import { Camera, Check, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useUpdateProfileMutation } from "@/domains/member/hooks";
import { errorMessage, uploadFile } from "@/components/admin/upload";
import { isApiError } from "@/lib/api/errors";
import { showErrorMessage, showLoginNudge, showSuccessToast } from "@/lib/toast/gr-toast";
import { NICKNAME_MAX } from "@/lib/profile";
import { cn } from "@/lib/utils";

// 마이프로필 수정: 아바타(이미지 업로드) + 표시명 + 발행용 주소 이름(handle).
// handle을 설정해야 도안 발행·공개가 열린다(없으면 발행 전 상태).
export function ProfileEdit({
  userId,
  displayName,
  handle,
  hasAvatar,
  preview: devPreview,
  setupHandle = false,
}: {
  userId: string;
  displayName: string;
  handle: string | null;
  hasAvatar: boolean;
  preview: boolean;
  setupHandle?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(setupHandle);
  const [name, setName] = useState(displayName);
  const [handleInput, setHandleInput] = useState(handle ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: updateProfile } = useUpdateProfileMutation();

  // 표시용 아바타: 새로 고른 파일 > 기존 업로드 > 이니셜.
  const shownAvatar = avatarUrl ?? (hasAvatar ? `/api/avatars/${userId}` : null);
  const initial = name.trim()[0] ?? "수";
  const handleLocked = !!handle; // 이미 설정된 handle은 바꾸지 않는다(공개 URL 안정).

  function pickAvatar(file: File | null) {
    if (!file) return;
    if (avatarUrl) URL.revokeObjectURL(avatarUrl);
    setAvatarFile(file);
    setAvatarUrl(URL.createObjectURL(file));
  }

  async function save() {
    if (!name.trim()) {
      showErrorMessage("이름을 입력해 주세요.");
      return;
    }
    const nextHandle = handleLocked ? undefined : handleInput.trim() || undefined;
    if (nextHandle && !/^[a-z0-9_]{2,30}$/.test(nextHandle)) {
      showErrorMessage("주소 이름은 영문 소문자·숫자·밑줄(_)로 2~30자예요.");
      return;
    }
    setSaving(true);
    try {
      const avatarUploadId = avatarFile
        ? await uploadFile("avatar", avatarFile, "/api/member")
        : undefined;
      await updateProfile({ displayName: name.trim(), handle: nextHandle, avatarUploadId });
      showSuccessToast("프로필을 저장했어요");
      setEditing(false);
      setAvatarFile(null);
      router.refresh();
    } catch (e) {
      if (isApiError(e) && e.status === 401) {
        showLoginNudge("로그인 후 바꿀 수 있어요", () => router.push("/artist/login"));
        return;
      }
      const code = e instanceof Error ? e.message : "";
      if (code === "handle_taken") showErrorMessage("이미 쓰는 주소 이름이에요. 다른 이름을 골라 주세요.");
      else showErrorMessage(errorMessage(code));
    } finally {
      setSaving(false);
    }
  }

  const avatar = (
    <span className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-4xl font-bold text-secondary-foreground ring-4 ring-accent">
      {shownAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shownAvatar} alt="프로필" className="size-full object-cover" />
      ) : (
        initial
      )}
      {editing && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity hover:bg-black/55"
          aria-label="프로필 이미지 바꾸기"
        >
          <Camera className="size-6" aria-hidden />
        </button>
      )}
    </span>
  );

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-background p-6 text-center sm:flex-row sm:text-left">
      {avatar}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg"
        className="sr-only"
        onChange={(e) => pickAvatar(e.target.files?.[0] ?? null)}
      />

      <div className="min-w-0 flex-1 space-y-2">
        {editing ? (
          <div className="space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NICKNAME_MAX}
              placeholder="이름"
              className="h-11 w-full max-w-xs rounded-lg border border-input bg-background px-3.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            {handleLocked ? (
              <p className="text-sm text-muted-foreground">작가 주소 @{handle} (변경 불가)</p>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">@</span>
                  <input
                    value={handleInput}
                    onChange={(e) => setHandleInput(e.target.value.toLowerCase())}
                    maxLength={30}
                    placeholder="주소이름 (영문·숫자·_)"
                    className="h-11 w-full max-w-xs rounded-lg border border-input bg-background px-3.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  주소 이름을 정하면 도안을 올리고 내 작가 페이지(/artists/주소이름)가 생겨요.
                </p>
              </div>
            )}
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                <Check className="size-4" aria-hidden />
                {saving ? "저장 중…" : "저장"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setName(displayName);
                  setHandleInput(handle ?? "");
                  setAvatarFile(null);
                  setAvatarUrl(null);
                }}
                className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium text-ink-700 transition-colors hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold text-foreground">{displayName}</h1>
            {handle ? (
              <p className="text-sm text-muted-foreground">@{handle}</p>
            ) : (
              <p className="text-sm text-amber-600">주소 이름을 정하면 도안을 올릴 수 있어요.</p>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-gray-50",
              )}
            >
              <Pencil className="size-3.5" aria-hidden />
              프로필 수정
            </button>
          </div>
        )}
        {devPreview && (
          <p className="text-xs text-muted-foreground">
            미리보기 모드예요 — 실제로는 로그인한 본인 계정이 보여요.
          </p>
        )}
      </div>
    </div>
  );
}
