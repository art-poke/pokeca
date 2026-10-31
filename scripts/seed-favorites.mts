// 데모: 마이프로필 미리보기용 회원 1명 + 카드 즐겨찾기 몇 개. 로컬 DB에만.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error(`로컬 DB에서만 실행하세요: ${url}`);
const db = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

// 고정 이메일은 listUsers 페이지네이션(>200 유저) 문제를 피하려고 새로 만든다. 옛 데모 회원은 그냥 둔다.
const email = `demo-member-${Date.now()}@example.com`;
const created = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name: "김트레이너" } });
if (created.error || !created.data.user) throw created.error ?? new Error("no user");
const uid = created.data.user.id;
await db.from("members").upsert({ user_id: uid, nickname: "김트레이너" });

// 즐겨찾기할 카드: 데모 도안이 있는 카드 + 아무 카드 몇 개.
const picks = [
  { set_code: "sv2a", collector_number: "201/165" },
  { set_code: "sv2a", collector_number: "205/165" },
];
const { data: some } = await db.from("cards").select("id").limit(4);
const ids = new Set<string>((some ?? []).map((c) => c.id));
for (const p of picks) {
  const { data } = await db
    .from("cards")
    .select("id")
    .eq("set_code", p.set_code)
    .eq("collector_number", p.collector_number)
    .maybeSingle();
  if (data) ids.add(data.id);
}
for (const cardId of ids) {
  const { error } = await db.from("favorites").insert({ user_id: uid, card_id: cardId });
  if (error && error.code !== "23505") throw error;
}
console.log(`favorites: ${ids.size} for @김트레이너 (${uid})`);
