"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import {
  currentSocialUser,
  requireProfile,
  replaceMyArtworkImage,
  setMyArtworkVisibility,
  SOCIAL_PROVIDERS,
  updateMyArtwork,
  withdrawMyArtwork,
  type SocialProvider,
} from "@/lib/artists";
import { ArtworkError } from "@/lib/artworks";

// 작가 server action. 로그인이 필요한 action은 requireProfile()로 시작한다.

export type FormState = { error: string } | null;

// 카카오·구글 로그인 시작. Auth.js가 공급자 화면과 /api/auth/callback/[provider]을 처리한다.
// 이미 로그인했으면 provider를 현재 계정에 링크(머지)하지 않도록 마이페이지로 보낸다.
export async function socialLogin(form: FormData) {
  if (await currentSocialUser()) redirect("/me");
  const provider = String(form.get("provider"));
  if (!SOCIAL_PROVIDERS.includes(provider as SocialProvider)) redirect("/artist/login");
  await signIn(provider, { redirectTo: "/me" });
}

export async function logout() {
  await signOut({ redirectTo: "/artist/login" });
}

// 내 도안 내리기(철회). 카드 번호를 그대로 입력해야 한다.
export async function withdraw(_prev: FormState, form: FormData): Promise<FormState> {
  const artist = await requireProfile();
  try {
    await withdrawMyArtwork(artist, String(form.get("id")), String(form.get("confirm") ?? ""));
  } catch (e) {
    if (e instanceof ArtworkError) {
      return { error: e.code === "confirm_mismatch" ? "카드 번호가 맞지 않아요." : "내리지 못했어요. 다시 시도해 주세요." };
    }
    throw e;
  }
  refresh();
  return null;
}

// 내 도안 공개/비공개 토글.
export async function setVisibility(id: string, visible: boolean): Promise<void> {
  const artist = await requireProfile();
  await setMyArtworkVisibility(artist, id, visible);
  refresh();
}

const EDIT_ERRORS: Record<string, string> = {
  artist_required: "작가 이름을 넣어 주세요.",
  invalid_source_url: "원본 글 주소는 http(s)://로 시작해야 해요.",
  source_visibility_required: "원본 글 공개 범위를 골라 주세요.",
  multi_piece_no_replace: "여러 조각(9포켓 등) 도안은 이미지 교체를 지원하지 않아요. 세부정보만 수정돼요.",
  not_found: "내 도안을 찾지 못했어요.",
};

// 내 도안 수정: 세부정보 + (선택) 이미지 교체.
export async function editArtwork(_prev: FormState, form: FormData): Promise<FormState> {
  const artist = await requireProfile();
  const id = String(form.get("id"));
  try {
    await updateMyArtwork(artist, id, {
      title: String(form.get("title") ?? ""),
      artistName: String(form.get("artistName") ?? ""),
      sourceUrl: String(form.get("sourceUrl") ?? "") || null,
      sourceVisibility: (String(form.get("sourceVisibility") ?? "") || null) as "public" | "members_only" | null,
    });
    const uploadId = String(form.get("originalUploadId") ?? "");
    if (uploadId) await replaceMyArtworkImage(artist, id, uploadId);
  } catch (e) {
    if (e instanceof ArtworkError) return { error: EDIT_ERRORS[e.code] ?? "수정하지 못했어요. 다시 시도해 주세요." };
    throw e;
  }
  redirect("/me?edited=1");
}
