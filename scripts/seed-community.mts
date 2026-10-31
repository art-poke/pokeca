// 데모: 회원 + 추천/다운로드(engagements) + 도안 요청 + 커뮤니티 글/댓글.
// 로컬에서만. `node --env-file-if-exists=.env.local --import tsx scripts/seed-community.mts`
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SECRET_KEY!;
const sb = createClient(url, key, { auth: { persistSession: false } });

async function ensureUser(name: string): Promise<string> {
  const email = `demo-${encodeURIComponent(name)}@example.com`;
  const created = await sb.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name },
  });
  if (created.data?.user) return created.data.user.id;
  // 이미 있으면 목록에서 찾는다.
  const { data } = await sb.auth.admin.listUsers({ perPage: 200 });
  const found = data.users.find((u) => u.email === email);
  if (!found) throw new Error(`cannot create/find user ${email}`);
  return found.id;
}

const NAMES = ["김트레이너", "이수집가", "박포켓", "최바인더", "정도감"];

const users: { id: string; name: string }[] = [];
for (const name of NAMES) {
  const id = await ensureUser(name);
  await sb.from("members").upsert({ user_id: id, nickname: name });
  users.push({ id, name });
}
console.log(`members: ${users.length}`);

// active 도안
const { data: arts, error: artErr } = await sb
  .from("artworks")
  .select("id, card_id")
  .eq("status", "active");
if (artErr) throw artErr;
console.log(`artworks: ${arts!.length}`);

// engagements: 유저마다 도안 일부에 추천/다운로드(배타, 유저·도안당 1행)
let eng = 0;
for (let ui = 0; ui < users.length; ui++) {
  for (let ai = 0; ai < arts!.length; ai++) {
    // 앞쪽 도안일수록 추천을 더 많이 받게(랭킹 차이)
    if ((ui + ai) % 2 === 0 && ai <= users.length - ui) {
      const kind = ai % 3 === 0 ? "download" : "recommend";
      const { error } = await sb
        .from("engagements")
        .upsert(
          { user_id: users[ui].id, artwork_id: arts![ai].id, kind },
          { onConflict: "user_id,artwork_id", ignoreDuplicates: true },
        );
      if (!error) eng++;
    }
  }
}
console.log(`engagements: ~${eng}`);

// 도안 요청: 몇몇 카드를 여러 회원이 요청(요청방)
const { data: cards } = await sb.from("cards").select("id").limit(6);
let reqs = 0;
for (let ci = 0; ci < cards!.length; ci++) {
  for (let ui = 0; ui <= ci && ui < users.length; ui++) {
    const { error } = await sb
      .from("requests")
      .upsert(
        { card_id: cards![ci].id, user_id: users[ui].id },
        { onConflict: "card_id,user_id", ignoreDuplicates: true },
      );
    if (!error) reqs++;
  }
}
console.log(`requests: ~${reqs}`);

// 커뮤니티 글 + 댓글
const posts = [
  { board: "notice", author: "운영자", title: "확장 아트 아카이브 오픈 안내", body: "커뮤니티·랭킹 기능이 추가됐어요. 많이 이용해 주세요!" },
  { board: "suggestion", author: users[0].name, title: "다운로드 기록 통계 보여주면 좋겠어요", body: "내가 받은 도안 목록을 마이페이지에서 보고 싶어요." },
  { board: "free", author: users[1].name, title: "리자몽 9포켓 완성했어요 자랑합니다", body: "별빛도안 작가님 도안으로 바인더 채웠는데 너무 예뻐요." },
];
for (let i = 0; i < posts.length; i++) {
  const p = posts[i];
  const uid = i === 0 ? users[0].id : users[i % users.length].id;
  const { data: post, error } = await sb
    .from("posts")
    .insert({ board: p.board, user_id: uid, author_name: p.author, title: p.title, body: p.body })
    .select("id")
    .single();
  if (error) {
    console.log("post skip", error.message);
    continue;
  }
  // 댓글 1~2개 + 대댓글
  const c1 = await sb
    .from("comments")
    .insert({
      target_type: "post",
      target_id: post!.id,
      user_id: users[2].id,
      author_name: users[2].name,
      body: "좋은 소식이네요!",
    })
    .select("id")
    .single();
  if (c1.data) {
    await sb.from("comments").insert({
      target_type: "post",
      target_id: post!.id,
      user_id: users[3].id,
      author_name: users[3].name,
      parent_id: c1.data.id,
      body: "저도 동의해요 👍",
    });
  }
}
console.log("posts+comments seeded");
console.log("done");
