import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

// 중복 글 정리(시드 두 번 실행분): 같은 제목이면 가장 오래된 것만 남긴다.
const { data: allPosts } = await sb
  .from("posts")
  .select("id, title, created_at")
  .order("created_at", { ascending: true });
const seen = new Set<string>();
for (const p of allPosts ?? []) {
  if (seen.has(p.title)) await sb.from("posts").delete().eq("id", p.id);
  else seen.add(p.title);
}
console.log(`posts deduped → ${seen.size}`);

// 회원 + 카드
const { data: members } = await sb.from("members").select("user_id").limit(5);
const { data: cards } = await sb.from("cards").select("id").limit(6);
const uids = (members ?? []).map((m) => m.user_id);

// 도안 요청: 카드마다 요청 수를 다르게(요청방 랭킹). plain insert + 중복 무시.
let reqs = 0;
for (let ci = 0; ci < (cards?.length ?? 0); ci++) {
  const n = Math.min(ci + 1, uids.length); // 카드 0→1명, 1→2명 ...
  for (let ui = 0; ui < n; ui++) {
    const { error } = await sb
      .from("requests")
      .insert({ card_id: cards![ci].id, user_id: uids[ui] });
    if (!error) reqs++;
    else if (error.code !== "23505") console.log("req err", error.message);
  }
}
console.log(`requests inserted: ${reqs}`);
console.log("done");
