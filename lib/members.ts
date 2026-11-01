import "server-only";
import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { artists, favorites, members } from "@/lib/db/schema";
import { currentSocialUser } from "@/lib/artists";
import { NICKNAME_MAX } from "@/lib/profile";
import { promoteAvatar, removeAvatar, StorageInputError } from "@/lib/storage";

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
  const rows = await db
    .select({ displayName: artists.displayName })
    .from(artists)
    .where(eq(artists.userId, userId))
    .limit(1);
  return rows[0]?.displayName ?? null;
}

async function withDisplayName(row: {
  userId: string;
  nickname: string;
  avatarPath: string | null;
}): Promise<Member> {
  const artistName = await artistDisplayName(row.userId);
  return {
    userId: row.userId,
    nickname: row.nickname,
    displayName: artistName ?? row.nickname,
    avatarPath: row.avatarPath,
  };
}

const memberColumns = {
  userId: members.userId,
  nickname: members.nickname,
  avatarPath: members.avatarPath,
};

// member 행을 보장(없으면 소셜 이름으로 생성)하고 표시명과 함께 돌려준다.
export async function currentMember(): Promise<Member | null> {
  const user = await currentSocialUser();
  if (!user) return null;

  const existing = await db.select(memberColumns).from(members).where(eq(members.userId, user.id)).limit(1);
  if (existing[0]) return withDisplayName(existing[0]);

  const nickname = (user.name?.trim() || `수집가-${user.id.slice(0, 4)}`).slice(0, 40);
  try {
    await db.insert(members).values({ userId: user.id, nickname });
  } catch (e) {
    // 동시 첫 요청 경합: 이미 생겼으면 그대로 둔다.
    if ((e as { code?: string })?.code !== "23505") throw e;
  }
  return withDisplayName({ userId: user.id, nickname, avatarPath: null });
}

// 개발 미리보기용: 회원 아무나 1명(로컬에서 로그인 없이 마이프로필 UI 확인).
// 즐겨찾기가 있는 회원을 먼저 고른다(미리보기에서 목록이 보이게). 없으면 가장 먼저 만든 회원.
export async function anyMember(): Promise<Member | null> {
  const fav = await db
    .select({ userId: favorites.userId })
    .from(favorites)
    .orderBy(desc(favorites.createdAt))
    .limit(1);

  let row: { userId: string; nickname: string; avatarPath: string | null } | undefined;
  if (fav[0]) {
    const r = await db.select(memberColumns).from(members).where(eq(members.userId, fav[0].userId)).limit(1);
    row = r[0];
  }
  if (!row) {
    const r = await db.select(memberColumns).from(members).orderBy(asc(members.createdAt)).limit(1);
    row = r[0];
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

  const patch: { nickname: string; avatarPath?: string } = { nickname };
  let oldPath: string | null = null;
  if (input.avatarUploadId) {
    const prev = await db
      .select({ avatarPath: members.avatarPath })
      .from(members)
      .where(eq(members.userId, userId))
      .limit(1);
    oldPath = prev[0]?.avatarPath ?? null;
    try {
      patch.avatarPath = await promoteAvatar(input.avatarUploadId, userId);
    } catch (e) {
      if (e instanceof StorageInputError) throw new MemberError(e.message);
      throw e;
    }
  }

  await db.update(members).set(patch).where(eq(members.userId, userId));
  // 새 이미지로 바꿨으면 옛 이미지 정리(실패해도 무시).
  if (oldPath && patch.avatarPath && oldPath !== patch.avatarPath) {
    await removeAvatar(oldPath).catch(() => {});
  }
}
