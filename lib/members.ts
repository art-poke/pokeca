import "server-only";
import { redirect } from "next/navigation";
import { currentSocialUser } from "@/lib/artists";
import { NICKNAME_MAX } from "@/lib/profile";
import { promoteAvatar, removeAvatar, StorageInputError } from "@/lib/storage";
import { db } from "@/lib/supabase/server";

// 일반 회원(member): 로그인한 소셜 유저. 작가 신청 전일 수 있다.
// 추천·다운로드·댓글·커뮤니티·도안 요청·즐겨찾기의 주체. 첫 참여 때 소셜 이름으로 member 행을 만든다.
export type Member = {
  userId: string;
  nickname: string;
  // 표시명: 승인/신청된 작가면 작가 이름, 아니면 닉네임. 댓글·글 작성자 스냅샷에 쓴다.
  displayName: string;
  // 프로필 이미지 경로(없으면 null → 이니셜로 보여 준다).
  avatarPath: string | null;
};

export class MemberError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

async function artistDisplayName(userId: string): Promise<string | null> {
  const { data, error } = await db()
    .from("artists")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle<{ display_name: string }>();
  if (error) throw error;
  return data?.display_name ?? null;
}

async function withDisplayName(row: {
  user_id: string;
  nickname: string;
  avatar_path: string | null;
}): Promise<Member> {
  const artistName = await artistDisplayName(row.user_id);
  return {
    userId: row.user_id,
    nickname: row.nickname,
    displayName: artistName ?? row.nickname,
    avatarPath: row.avatar_path,
  };
}

// member 행을 보장(없으면 소셜 이름으로 생성)하고 표시명과 함께 돌려준다.
export async function currentMember(): Promise<Member | null> {
  const user = await currentSocialUser();
  if (!user) return null;
  const client = db();

  const existing = await client
    .from("members")
    .select("user_id, nickname, avatar_path")
    .eq("user_id", user.id)
    .maybeSingle<{ user_id: string; nickname: string; avatar_path: string | null }>();
  if (existing.error) throw existing.error;

  if (existing.data) return withDisplayName(existing.data);

  const nickname = (user.name?.trim() || `수집가-${user.id.slice(0, 4)}`).slice(0, 40);
  const created = await client.from("members").insert({ user_id: user.id, nickname });
  // 동시 첫 요청 경합: 이미 생겼으면 그대로 둔다.
  if (created.error && created.error.code !== "23505") throw created.error;
  return withDisplayName({ user_id: user.id, nickname, avatar_path: null });
}

// 개발 미리보기용: 회원 아무나 1명(로컬에서 로그인 없이 마이프로필 UI 확인).
// 즐겨찾기가 있는 회원을 먼저 고른다(미리보기에서 목록이 보이게). 없으면 가장 먼저 만든 회원.
export async function anyMember(): Promise<Member | null> {
  const select = "user_id, nickname, avatar_path";
  const fav = await db()
    .from("favorites")
    .select("user_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ user_id: string }>();
  if (fav.error) throw fav.error;

  let row: { user_id: string; nickname: string; avatar_path: string | null } | null = null;
  if (fav.data) {
    const r = await db().from("members").select(select).eq("user_id", fav.data.user_id).maybeSingle();
    if (r.error) throw r.error;
    row = r.data as typeof row;
  }
  if (!row) {
    const r = await db().from("members").select(select).order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (r.error) throw r.error;
    row = r.data as typeof row;
  }
  return row ? withDisplayName(row) : null;
}

// 회원 전용 화면·server action의 첫 줄. 로그인 안 했으면 로그인으로 보낸다.
export async function requireMember(): Promise<Member> {
  const member = await currentMember();
  if (!member) redirect("/artist/login");
  return member;
}

// 프로필 수정: 닉네임(필수) + 프로필 이미지(선택, 업로드 ID). 이미지를 바꾸면 옛 파일은 지운다.
export async function updateProfile(
  userId: string,
  input: { nickname: string; avatarUploadId?: string | null },
): Promise<void> {
  const nickname = input.nickname.trim();
  if (!nickname) throw new MemberError("nickname_required");
  if (nickname.length > NICKNAME_MAX) throw new MemberError("nickname_too_long");

  const patch: { nickname: string; avatar_path?: string } = { nickname };
  let oldPath: string | null = null;
  if (input.avatarUploadId) {
    const prev = await db()
      .from("members")
      .select("avatar_path")
      .eq("user_id", userId)
      .maybeSingle<{ avatar_path: string | null }>();
    if (prev.error) throw prev.error;
    oldPath = prev.data?.avatar_path ?? null;
    try {
      patch.avatar_path = await promoteAvatar(input.avatarUploadId, userId);
    } catch (e) {
      if (e instanceof StorageInputError) throw new MemberError(e.message);
      throw e;
    }
  }

  const { error } = await db().from("members").update(patch).eq("user_id", userId);
  if (error) throw error;
  // 새 이미지로 바꿨으면 옛 이미지 정리(실패해도 무시).
  if (oldPath && patch.avatar_path && oldPath !== patch.avatar_path) {
    await removeAvatar(oldPath).catch(() => {});
  }
}
