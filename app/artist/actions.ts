"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import {
  ArtistError,
  registerArtist,
  requireApplicant,
  requireArtist,
  SOCIAL_PROVIDERS,
  withdrawMyArtwork,
  type SocialProvider,
} from "@/lib/artists";
import { ArtworkError } from "@/lib/artworks";

// 작가 server action. 로그인이 필요한 action은 requireArtist()로 시작한다.

export type FormState = { error: string } | null;

const APPLY_ERRORS: Record<string, string> = {
  invalid_handle: "주소 이름은 영문 소문자·숫자·밑줄(_)로 2~30자예요.",
  handle_taken: "이미 쓰는 주소 이름이에요. 다른 이름을 골라 주세요.",
  invalid_name: "작가 이름을 1~40자로 넣어 주세요.",
  intro_too_long: "소개는 300자까지 쓸 수 있어요.",
  invalid_link: "링크는 http(s)://로 시작해야 해요.",
};

// 카카오·구글 로그인 시작. Auth.js가 공급자 화면과 /api/auth/callback/[provider]을 처리한다.
export async function socialLogin(form: FormData) {
  const provider = String(form.get("provider"));
  if (!SOCIAL_PROVIDERS.includes(provider as SocialProvider)) redirect("/artist/login");
  await signIn(provider, { redirectTo: "/artist" });
}

// 처음 로그인한 사람의 작가 신청. 어드민이 승인하면 도안을 올릴 수 있다.
export async function apply(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireApplicant();
  try {
    await registerArtist(user, {
      handle: String(form.get("handle") ?? ""),
      displayName: String(form.get("displayName") ?? ""),
      intro: String(form.get("intro") ?? ""),
      linkUrl: String(form.get("linkUrl") ?? ""),
    });
  } catch (e) {
    if (e instanceof ArtistError) {
      if (e.code === "already_registered") redirect("/artist");
      return { error: APPLY_ERRORS[e.code] ?? "신청하지 못했어요. 다시 시도해 주세요." };
    }
    throw e;
  }
  redirect("/artist");
}

export async function logout() {
  await signOut({ redirectTo: "/artist/login" });
}

// 내 도안 내리기(철회). 카드 번호를 그대로 입력해야 한다.
export async function withdraw(_prev: FormState, form: FormData): Promise<FormState> {
  const artist = await requireArtist();
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
