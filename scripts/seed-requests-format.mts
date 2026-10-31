import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
// format 없는(구) 회원 요청 정리
await sb.from("requests").delete().is("format", null).not("user_id", "is", null);
const { data: members } = await sb.from("members").select("user_id").limit(5);
const uids = (members ?? []).map((m) => m.user_id);
// 도안 없는 카드 몇 개(demo 카드 피해서 offset)
const { data: cards } = await sb.from("cards").select("id, set_code, collector_number").range(20, 30);
const formats = ["9pocket", "psa", "brg"];
let n = 0;
for (let i = 0; i < (cards?.length ?? 0); i++) {
  const format = formats[i % 3];
  const count = Math.max(1, 6 - i); // 앞 카드일수록 요청 많이
  for (let u = 0; u < Math.min(count, uids.length); u++) {
    const { error } = await sb.from("requests").insert({ card_id: cards![i].id, user_id: uids[u], format });
    if (!error) n++;
    else if (error.code !== "23505") console.log("err", error.message);
  }
}
console.log("format requests inserted:", n);
