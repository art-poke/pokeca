"use client";

import { Camera, Check, MessageCircle, Pencil, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { errorMessage, uploadFile } from "@/components/admin/upload";
import type { ProfileActivity, ProfileLink } from "@/domains/member/api/types";
import { useUpdateProfileMutation } from "@/domains/member/hooks";
import { isApiError } from "@/lib/api/errors";
import { NICKNAME_MAX } from "@/lib/profile";
import { showErrorMessage, showLoginNudge, showSuccessToast } from "@/lib/toast/gr-toast";
import { cn } from "@/lib/utils";

const field =
  "h-11 w-full rounded-lg border border-input bg-background px-3.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

export function ProfileEdit({
  userId,
  displayName,
  handle,
  hasAvatar,
  email: email0,
  intro: intro0,
  links: links0,
  activities: activities0,
  preview: devPreview,
  setupHandle = false,
}: {
  userId: string;
  displayName: string;
  handle: string | null;
  hasAvatar: boolean;
  email: string | null;
  intro: string | null;
  links: ProfileLink[];
  activities: ProfileActivity[];
  preview: boolean;
  setupHandle?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(setupHandle);
  const [name, setName] = useState(displayName);
  const [handleInput, setHandleInput] = useState(handle ?? "");
  const [email, setEmail] = useState(email0 ?? "");
  const [intro, setIntro] = useState(intro0 ?? "");
  const [links, setLinks] = useState<ProfileLink[]>(links0 ?? []);
  const [activities, setActivities] = useState<ProfileActivity[]>(activities0 ?? []);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: updateProfile } = useUpdateProfileMutation();

  const shownAvatar = avatarUrl ?? (hasAvatar ? `/api/avatars/${userId}` : null);
  const initial = name.trim()[0] ?? "수";
  const handleLocked = !!handle;

  function pickAvatar(file: File | null) {
    if (!file) return;
    if (avatarUrl) URL.revokeObjectURL(avatarUrl);
    setAvatarFile(file);
    setAvatarUrl(URL.createObjectURL(file));
  }

  function resetEdits() {
    setName(displayName);
    setHandleInput(handle ?? "");
    setEmail(email0 ?? "");
    setIntro(intro0 ?? "");
    setLinks(links0 ?? []);
    setActivities(activities0 ?? []);
    setAvatarFile(null);
    setAvatarUrl(null);
  }

  async function save() {
    if (!name.trim()) return showErrorMessage("이름을 입력해 주세요.");
    const nextHandle = handleLocked ? undefined : handleInput.trim() || undefined;
    if (nextHandle && !/^[a-z0-9_]{2,30}$/.test(nextHandle)) {
      return showErrorMessage("주소 이름은 영문 소문자·숫자·밑줄(_)로 2~30자예요.");
    }
    setSaving(true);
    try {
      const avatarUploadId = avatarFile ? await uploadFile("avatar", avatarFile, "/api/member") : undefined;
      await updateProfile({
        displayName: name.trim(),
        handle: nextHandle,
        avatarUploadId,
        email: email.trim() || null,
        intro: intro.trim() || null,
        links: links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })).filter((l) => l.url),
        activities: activities.map((a) => ({ place: a.place.trim(), handle: a.handle.trim() })).filter((a) => a.place || a.handle),
      });
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
      else if (code === "invalid_email") showErrorMessage("이메일 형식이 올바르지 않아요.");
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

  if (editing) {
    return (
      <div className="rounded-2xl border border-border bg-background p-6">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => pickAvatar(e.target.files?.[0] ?? null)} />
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {avatar}
          <div className="w-full min-w-0 flex-1 space-y-4">
            <Labeled label="이름">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NICKNAME_MAX} placeholder="이름" className={field} />
            </Labeled>

            {handleLocked ? (
              <p className="text-sm text-muted-foreground">작가 주소 @{handle} (변경 불가)</p>
            ) : (
              <Labeled label="작가 주소 이름" hint="정하면 도안을 올리고 내 작가 페이지(/artists/주소이름)가 생겨요.">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">@</span>
                  <input value={handleInput} onChange={(e) => setHandleInput(e.target.value.toLowerCase())} maxLength={30} placeholder="영문·숫자·_" className={field} />
                </div>
              </Labeled>
            )}

            <Labeled label="이메일" hint="연락용(선택). 공개 프로필에 보여요.">
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" maxLength={120} placeholder="you@example.com" className={field} />
            </Labeled>

            <Labeled label="소개">
              <textarea value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={500} rows={3} placeholder="간단한 소개를 적어주세요" className={cn(field, "h-auto py-2.5 leading-relaxed")} />
            </Labeled>

            {/* 링크 여러 개: 오픈카톡 / 기타 */}
            <Labeled label="링크" hint="오픈 카카오톡, 트위터 등. 이름과 주소를 적어주세요.">
              <div className="space-y-2">
                {links.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={l.label}
                      onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                      maxLength={20}
                      placeholder="오픈카톡"
                      className={cn(field, "w-24 shrink-0 sm:w-28")}
                      list="link-labels"
                    />
                    <input
                      value={l.url}
                      onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                      type="url"
                      placeholder="https://open.kakao.com/..."
                      className={field}
                    />
                    <button type="button" onClick={() => setLinks(links.filter((_, j) => j !== i))} className="shrink-0 rounded-lg p-2 text-muted-foreground hover:text-destructive" aria-label="링크 삭제">
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
                <datalist id="link-labels">
                  <option value="오픈카톡" />
                  <option value="트위터" />
                  <option value="인스타" />
                  <option value="유튜브" />
                  <option value="기타" />
                </datalist>
                {links.length < 8 && (
                  <button type="button" onClick={() => setLinks([...links, { label: "", url: "" }])} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    <Plus className="size-4" /> 링크 추가
                  </button>
                )}
              </div>
            </Labeled>

            {/* 활동하는 곳 + 닉네임 */}
            <Labeled label="활동하는 곳 / 닉네임" hint="예: 더쿠 / 뮤츠덕후">
              <div className="space-y-2">
                {activities.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={a.place}
                      onChange={(e) => setActivities(activities.map((x, j) => (j === i ? { ...x, place: e.target.value } : x)))}
                      maxLength={30}
                      placeholder="활동하는 곳"
                      className={cn(field, "w-28 shrink-0 sm:w-36")}
                    />
                    <input
                      value={a.handle}
                      onChange={(e) => setActivities(activities.map((x, j) => (j === i ? { ...x, handle: e.target.value } : x)))}
                      maxLength={40}
                      placeholder="닉네임"
                      className={field}
                    />
                    <button type="button" onClick={() => setActivities(activities.filter((_, j) => j !== i))} className="shrink-0 rounded-lg p-2 text-muted-foreground hover:text-destructive" aria-label="활동처 삭제">
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
                {activities.length < 8 && (
                  <button type="button" onClick={() => setActivities([...activities, { place: "", handle: "" }])} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    <Plus className="size-4" /> 활동처 추가
                  </button>
                )}
              </div>
            </Labeled>

            <div className="flex items-center gap-2 pt-1">
              <button type="button" onClick={save} disabled={saving} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-red-700 disabled:opacity-60">
                <Check className="size-4" aria-hidden />
                {saving ? "저장 중…" : "저장"}
              </button>
              <button type="button" onClick={() => { setEditing(false); resetEdits(); }} className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium text-ink-700 transition-colors hover:bg-gray-50">
                취소
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 보기 모드
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-background p-6 text-center sm:flex-row sm:items-start sm:text-left">
      {avatar}
      <div className="min-w-0 flex-1 space-y-2">
        <h1 className="font-display text-2xl font-bold text-foreground">{displayName}</h1>
        {handle ? (
          <p className="text-sm text-muted-foreground">@{handle}</p>
        ) : (
          <p className="text-sm text-amber-600">주소 이름을 정하면 도안을 올릴 수 있어요.</p>
        )}
        {intro0 && <p className="whitespace-pre-wrap text-sm text-ink-700">{intro0}</p>}
        {email0 && <p className="text-sm text-muted-foreground">✉ {email0}</p>}

        {activities0 && activities0.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
            {activities0.map((a, i) => (
              <li key={i} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-ink-700">
                {a.place}{a.place && a.handle ? " · " : ""}{a.handle}
              </li>
            ))}
          </ul>
        )}

        {links0 && links0.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
            {links0.map((l, i) => (
              <Link key={i} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-ink-700 transition-colors hover:border-primary hover:text-primary">
                <MessageCircle className="size-3" aria-hidden />
                {l.label || "링크"}
              </Link>
            ))}
          </div>
        )}

        <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-gray-50">
          <Pencil className="size-3.5" aria-hidden />
          프로필 수정
        </button>
        {devPreview && <p className="text-xs text-muted-foreground">미리보기 모드예요 — 실제로는 로그인한 본인 계정이 보여요.</p>}
      </div>
    </div>
  );
}

function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-left">
      <span className="text-sm font-semibold text-ink-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
