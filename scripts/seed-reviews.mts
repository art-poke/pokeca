// 데모: 승인 작가들에게 회원이 남긴 작가 후기(텍스트). 로컬 DB에만.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error(`로컬 DB에서만 실행하세요: ${url}`);
const db = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

const BODIES = [
  "도안 퀄리티 진짜 좋아요! 9포켓 꽉 채웠습니다 👍",
  "인쇄 치수가 딱 맞아서 바로 썼어요. 감사합니다 :)",
  "색감이 미쳤네요… 다음 도안도 기대할게요!",
  "덕분에 바인더 완성했어요. 최고의 작가님",
  "요청했던 카드 올려주셔서 감사해요 ㅠㅠ",
];

const { data: artists } = await db.from("artists").select("user_id, display_name").eq("status", "approved");
const { data: members } = await db.from("members").select("user_id, nickname").limit(20);
if (!artists?.length || !members?.length) {
  console.log("no artists/members to seed reviews");
  process.exit(0);
}

let n = 0;
for (let ai = 0; ai < artists.length; ai++) {
  const artist = artists[ai];
  // 작가 본인이 아닌 회원 2명이 후기 작성.
  const reviewers = members.filter((m) => m.user_id !== artist.user_id).slice(ai % 2, (ai % 2) + 2);
  for (let ri = 0; ri < reviewers.length; ri++) {
    const m = reviewers[ri];
    const { error } = await db.from("artist_reviews").insert({
      artist_id: artist.user_id,
      user_id: m.user_id,
      author_name: m.nickname,
      body: BODIES[(ai + ri) % BODIES.length],
    });
    if (error && error.code !== "23505") throw error;
    n++;
  }
}
console.log(`reviews: ${n}`);
