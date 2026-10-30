import "server-only";
import { redirect } from "next/navigation";
import { currentSocialUser } from "@/lib/artists";
import { db } from "@/lib/supabase/server";

// 일반 회원(member): 로그인한 소셜 유저. 작가 신청 전일 수 있다.
// 추천·다운로드·댓글·커뮤니티·도안 요청의 주체. 첫 참여 때 소셜 이름으로 member 행을 만든다.
export type Member = {
  userId: string;
  nickname: string;
  // 표시명: 승인/신청된 작가면 작가 이름, 아니면 닉네임. 댓글·글 작성자 스냅샷에 쓴다.
  displayName: string;
};

async function artistDisplayName(userId: string): Promise<string | null> {
  const { data, error } = await db()
    .from("artists")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle<{ display_name: string }>();
  if (error) throw error;
  return data?.display_name ?? null;
}

// member 행을 보장(없으면 소셜 이름으로 생성)하고 표시명과 함께 돌려준다.
export async function currentMember(): Promise<Member | null> {
  const user = await currentSocialUser();
  if (!user) return null;
  const client = db();

  let nickname: string;
  const existing = await client
    .from("members")
    .select("nickname")
    .eq("user_id", user.id)
    .maybeSingle<{ nickname: string }>();
  if (existing.error) throw existing.error;

  if (existing.data) {
    nickname = existing.data.nickname;
  } else {
    nickname = (user.name?.trim() || `수집가-${user.id.slice(0, 4)}`).slice(0, 40);
    const created = await client.from("members").insert({ user_id: user.id, nickname });
    // 동시 첫 요청 경합: 이미 생겼으면 그대로 둔다.
    if (created.error && created.error.code !== "23505") throw created.error;
  }

  const artistName = await artistDisplayName(user.id);
  return { userId: user.id, nickname, displayName: artistName ?? nickname };
}

// 회원 전용 화면·server action의 첫 줄. 로그인 안 했으면 로그인으로 보낸다.
export async function requireMember(): Promise<Member> {
  const member = await currentMember();
  if (!member) redirect("/artist/login");
  return member;
}
