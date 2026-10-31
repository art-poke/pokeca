// 데모: active 도안의 작가명마다 작가 계정을 만들고 artist_id를 연결 + engagement로 점수 차등.
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

// 이미 있으면 모든 페이지를 훑어 찾는다(테스트가 유저를 수백 개 쌓아 1페이지로는 못 찾음).
async function findUserId(email: string): Promise<string | null> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const u = data.users.find((x) => x.email === email);
    if (u) return u.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function ensureUser(email: string, name: string): Promise<string> {
  const created = await sb.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name } });
  if (created.data?.user) return created.data.user.id;
  const id = await findUserId(email);
  if (!id) throw new Error(`no user ${email}`);
  return id;
}

// 작가로 만들 이름 → 핸들
const ARTISTS: Record<string, string> = {
  별빛도안: "byeolbit",
  불꽃공방: "flamestudio",
  새벽작업실: "dawnworks",
  리자몽러버: "charlover",
  숲속도안: "forestart",
};

const byName = new Map<string, string>();
let i = 0;
for (const [name, handle] of Object.entries(ARTISTS)) {
  const uid = await ensureUser(`artist-${handle}@example.com`, name);
  await sb.from("members").upsert({ user_id: uid, nickname: name });
  await sb
    .from("artists")
    .upsert({ user_id: uid, handle, display_name: name, provider: "google", status: "approved" });
  // 이 이름의 도안에 artist_id 연결
  await sb.from("artworks").update({ artist_id: uid }).eq("artist_name", name);
  byName.set(name, uid);
  i++;
}
console.log(`artists: ${byName.size}`);

// 점수용 member(비작가 뷰어) 확보
const viewers: string[] = [];
for (const name of ["김트레이너", "이수집가", "박포켓", "최바인더", "정도감"]) {
  const uid = await ensureUser(`viewer-${encodeURIComponent(name)}@example.com`, name);
  await sb.from("members").upsert({ user_id: uid, nickname: name });
  viewers.push(uid);
}

// active 도안
const { data: arts } = await sb.from("artworks").select("id, artist_name").eq("status", "active");
// 작가별 도안 수가 다르게 → 점수 차등(앞 작가일수록 추천 많이)
const order = Object.keys(ARTISTS);
let eng = 0;
for (const art of arts ?? []) {
  const rank = order.indexOf(art.artist_name);
  const n = rank < 0 ? 1 : Math.max(1, order.length - rank); // 별빛도안 5, 불꽃공방 4 ...
  for (let v = 0; v < Math.min(n, viewers.length); v++) {
    const kind = v % 3 === 0 ? "download" : "recommend";
    const { error } = await sb
      .from("engagements")
      .upsert(
        { user_id: viewers[v], artwork_id: art.id, kind },
        { onConflict: "user_id,artwork_id", ignoreDuplicates: true },
      );
    if (!error) eng++;
  }
}
console.log(`engagements: ~${eng}`);
console.log("done");
