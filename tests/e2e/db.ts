import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import sharp from "sharp";

// E2E 테스트 데이터 준비. 앱 코드(lib/)를 거치지 않고 로컬 DB·저장소에 직접 넣는다.
// 데이터는 Drizzle 직결 DB(DATABASE_URL, 5432)로. 스토리지는 아직 Supabase(sub D)다 —
// lib/storage-client.ts는 "server-only"라 Playwright(순수 node)에서 못 읽으므로 여기서 직접 만든다.
export const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {} });
const storage = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  }).storage;

export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3, 4]);
// 화면에 실제로 그려지는 작은 이미지(카드 비율). 서버가 미리보기를 만들 수 있는 진짜 PNG다.
// Playwright는 테스트를 CommonJS로 읽어 최상위 await를 쓸 수 없다. 처음 부를 때 만든다.
let preview: Promise<Buffer> | null = null;
export function previewPng(): Promise<Buffer> {
  preview ??= sharp({ create: { width: 63, height: 88, channels: 4, background: { r: 36, g: 69, b: 168, alpha: 1 } } })
    .png()
    .toBuffer();
  return preview;
}

type Seed = {
  number?: string;
  artist?: string;
  format?: "9pocket" | "psa" | "brg";
  status?: "active" | "hidden" | "withdrawn";
  sourceUrl?: string | null;
  visibility?: "public" | "members_only";
  linkStatus?: string;
  printSizeVerified?: boolean;
};

export async function seedArtwork(s: Seed = {}): Promise<string> {
  const id = crypto.randomUUID();
  const sourceUrl = s.sourceUrl === undefined ? "https://cafe.naver.com/example/1" : s.sourceUrl;
  const [card] = await sql<{ id: string }[]>`
    select id from cards where set_code = 'sv2a' and collector_number = ${s.number ?? "201/165"}`;
  await sql`insert into artworks (id, upload_id, card_id, artist_name, format, source_url, source_visibility,
      status, link_status, print_size_verified)
    values (${id}, ${id}, ${card.id}, ${s.artist ?? "e2e작가"}, ${s.format ?? "9pocket"}, ${sourceUrl},
      ${sourceUrl ? (s.visibility ?? "public") : null}, ${s.status ?? "active"},
      ${s.linkStatus ?? "ok"}, ${s.printSizeVerified ?? false})`;
  const bytes = await previewPng();
  for (const kind of ["original", "thumbnail"]) {
    const path = `artworks/${id}/${kind}-e2e`;
    const { error } = await storage().from("artworks").upload(path, bytes, { contentType: "image/png" });
    if (error) throw error;
    await sql`insert into artwork_files (artwork_id, kind, path, mime_type, size_bytes)
      values (${id}, ${kind}, ${path}, 'image/png', ${bytes.length})`;
  }
  return id;
}

export async function clearArtworks(): Promise<void> {
  await sql`truncate artworks, artwork_files, consent_events, reports, report_throttle, requests, card_demand, events cascade`;
  for (const bucket of ["artworks", "consent-evidence"]) {
    const objects = await sql<{ name: string }[]>`select name from storage.objects where bucket_id = ${bucket}`;
    if (objects.length) await storage().from(bucket).remove(objects.map((o) => o.name));
  }
}

// 작가 계정과 로그인 계정을 지운다(작품의 artist_id는 비워진다).
export async function clearArtists(): Promise<void> {
  const rows = await sql<{ user_id: string }[]>`select user_id from artists`;
  for (const r of rows) await sql`delete from users where id = ${r.user_id}`;
}

// 어드민 로그인용 계정. 공개 가입이 꺼져 있어 CLI/DB로만 만든다.
export const ADMIN = { email: "admin-e2e@example.com", password: "e2e-admin-password" };
export const NOT_ADMIN = { email: "visitor-e2e@example.com", password: "e2e-visitor-password" };

// users에 bcrypt 해시로 계정을 넣고, admin이면 admins 허용 목록에도 추가한다(create-admin.mts와 동일).
export async function ensureUser(user: { email: string; password: string }, admin: boolean): Promise<void> {
  const hash = await bcrypt.hash(user.password, 12);
  const [row] = await sql<{ id: string }[]>`
    insert into users (email, password_hash) values (${user.email}, ${hash})
    on conflict (email) do update set password_hash = excluded.password_hash
    returning id`;
  if (admin) {
    await sql`insert into admins (user_id, email) values (${row.id}, ${user.email}) on conflict do nothing`;
  }
}

// 비밀번호로 Auth.js Credentials 로그인을 서버 쪽에서 돌리고, 브라우저에 넣을 세션 쿠키를 돌려준다.
// Auth.js는 CSRF 토큰 → callback/credentials POST → Set-Cookie(authjs.session-token) 순서로 세션을 심는다.
// (Credentials는 어드민만 authorize한다 — 비어드민 세션은 이 경로로 만들 수 없다.)
export async function sessionCookies(email: string, password: string, baseURL: string) {
  const jar = new Map<string, string>();
  const readSetCookie = (res: Response) => {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  };
  const cookieHeader = () => [...jar].map(([n, v]) => `${n}=${v}`).join("; ");

  const csrfRes = await fetch(new URL("/api/auth/csrf", baseURL), { headers: { cookie: cookieHeader() } });
  readSetCookie(csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const body = new URLSearchParams({ email, password, csrfToken, callbackUrl: baseURL, json: "true" });
  const loginRes = await fetch(new URL("/api/auth/callback/credentials", baseURL), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body,
    redirect: "manual",
  });
  readSetCookie(loginRes);

  const url = new URL(baseURL);
  return [...jar].map(([name, value]) => ({ name, value, domain: url.hostname, path: "/" }));
}

// 카카오/구글 소셜 세션은 OAuth 공급자 콘솔(리다이렉트 URI·시크릿)이 있어야 흉내 낼 수 있다.
// 환경에 콘솔이 없어 서브 C에서는 막혀 있다 — 이 헬퍼를 쓰는 e2e는 test.skip 처리한다.
// blocked: needs kakao/google console (sub C follow-up)
export async function socialSessionCookies(_email: string, _baseURL: string): Promise<never> {
  throw new Error("socialSessionCookies blocked: needs kakao/google OAuth console (sub C follow-up)");
}
