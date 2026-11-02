"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { closeReport, LINK_STATUSES, linkReport, setLinkStatus, type LinkStatus } from "@/lib/admin-data";
import { setArtistStatus, type ArtistStatus } from "@/lib/artists";
import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";

// 어드민 server action. 각 action은 requireAdmin()으로 시작한다(화면 보호와 별개로 직접 호출도 막는다).

export type LoginState = { error: string } | null;

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      redirectTo: "/admin/artworks",
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: "이메일 또는 비밀번호가 맞지 않아요." };
    throw e; // Next redirect()는 예외로 동작한다 — 반드시 다시 던진다.
  }
  return null;
}

export async function logout() {
  await signOut({ redirectTo: "/admin/login" });
}

// 수동 링크 점검 기록 (eng E6).
export async function recordLinkCheck(form: FormData) {
  await requireAdmin();
  const status = String(form.get("linkStatus"));
  if (!LINK_STATUSES.includes(status as LinkStatus)) return;
  await setLinkStatus(String(form.get("id")), status as LinkStatus);
  refresh();
}

// 작가 계정 승인·거절. 거절하면 새 업로드만 막는다.
export async function reviewArtist(form: FormData) {
  const admin = await requireAdmin();
  const status = String(form.get("status"));
  if (status !== "approved" && status !== "rejected") return;
  await setArtistStatus(String(form.get("userId")), status as ArtistStatus, admin.email);
  refresh();
}

// 신고 처리 (eng E7).
export async function attachReport(form: FormData) {
  await requireAdmin();
  await linkReport(String(form.get("reportId")), String(form.get("artworkId")));
  refresh();
}

export async function resolveReport(form: FormData) {
  await requireAdmin();
  const status = form.get("status") === "no_target" ? "no_target" : "resolved";
  await closeReport(String(form.get("reportId")), status, String(form.get("note") ?? ""));
  refresh();
}
