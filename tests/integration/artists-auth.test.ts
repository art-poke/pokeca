import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";

// @/auth는 node 전용 next-auth를 끌어와 테스트 환경에서 import가 깨진다(admin 테스트와 동일).
// 전체를 모킹하고 세션은 테스트마다 setSession으로 바꾼다.
const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: authMock, signIn: vi.fn(), signOut: vi.fn() }));
const setSession = (value: unknown) => authMock.mockResolvedValue(value);

// currentSocialUser의 connection()(동적 렌더 강제)은 요청 스코프 밖에선 던진다 → no-op 모킹.
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  connection: async () => {},
}));

// 유저=작가 통합 후: 로그인=프로필 자동생성. 승인/members 없음. handle은 발행 전 null.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const stamp = Date.now();
const EMAIL = `profile-test-${stamp}@pokeca.local`;
const OTHER_EMAIL = `profile-test-other-${stamp}@pokeca.local`;
const HANDLE = `t_${stamp}`.slice(0, 30);

let userId: string;
let otherUserId: string;

async function makeUser(email: string): Promise<string> {
  const u = await pool.query(`insert into users (email) values ($1) returning id`, [email]);
  return u.rows[0].id;
}

beforeAll(async () => {
  userId = await makeUser(EMAIL);
  otherUserId = await makeUser(OTHER_EMAIL);
});

beforeEach(() => setSession(null));

afterAll(async () => {
  // users on delete cascade로 artists 행도 함께 지워진다.
  await pool.query(`delete from users where id = any($1::uuid[])`, [[userId, otherUserId]]);
  await pool.end();
});

const social = (id: string, email: string, name = "테스트작가") => ({
  id,
  email,
  provider: "kakao" as const,
  name,
});

describe("ensureProfile / 자동 생성", () => {
  it("프로필이 없으면 소셜 이름으로 만들고 handle=null로 돌려준다", async () => {
    const { ensureProfile } = await import("@/lib/artists");
    const p = await ensureProfile(social(userId, EMAIL, "두리"));
    expect(p).toMatchObject({ userId, displayName: "두리", handle: null, avatarPath: null, provider: "kakao" });
    expect("status" in p).toBe(false);
    expect(typeof p.createdAt).toBe("string");
    // DB에 실제로 행이 생겼다.
    const row = await pool.query(`select display_name, handle from artists where user_id = $1`, [userId]);
    expect(row.rows[0]?.display_name).toBe("두리");
    expect(row.rows[0]?.handle).toBeNull();
  });

  it("이미 있으면 그 프로필을 그대로 돌려준다(중복 생성 안 함)", async () => {
    const { ensureProfile } = await import("@/lib/artists");
    const again = await ensureProfile(social(userId, EMAIL, "바뀐이름무시"));
    expect(again.displayName).toBe("두리"); // 기존 값 유지
  });
});

describe("setHandle / 발행 주소", () => {
  it("handle을 설정한다", async () => {
    const { setHandle } = await import("@/lib/artists");
    await setHandle(userId, HANDLE);
    const row = await pool.query(`select handle from artists where user_id = $1`, [userId]);
    expect(row.rows[0]?.handle).toBe(HANDLE);
  });

  it("형식이 틀리면 invalid_handle", async () => {
    const { setHandle, ArtistError } = await import("@/lib/artists");
    const err = await setHandle(userId, "대문자X").catch((e) => e);
    expect(err).toBeInstanceOf(ArtistError);
    expect(err).toMatchObject({ code: "invalid_handle" });
  });

  it("다른 유저가 같은 handle을 쓰면 handle_taken", async () => {
    const { ensureProfile, setHandle } = await import("@/lib/artists");
    await ensureProfile(social(otherUserId, OTHER_EMAIL, "다른이"));
    await expect(setHandle(otherUserId, HANDLE)).rejects.toMatchObject({ code: "handle_taken" });
  });
});

describe("updateProfile / 표시명", () => {
  it("displayName을 바꾼다", async () => {
    const { updateProfile } = await import("@/lib/artists");
    await updateProfile(userId, { displayName: "새 이름" });
    const row = await pool.query(`select display_name from artists where user_id = $1`, [userId]);
    expect(row.rows[0]?.display_name).toBe("새 이름");
  });

  it("빈 이름은 nickname_required", async () => {
    const { updateProfile, ArtistError } = await import("@/lib/artists");
    const err = await updateProfile(userId, { displayName: "   " }).catch((e) => e);
    expect(err).toBeInstanceOf(ArtistError);
    expect(err).toMatchObject({ code: "nickname_required" });
  });
});

describe("currentArtist (세션 모킹)", () => {
  it("소셜 세션이면 프로필을 돌려준다(없으면 생성)", async () => {
    setSession({ user: { id: userId, email: EMAIL, name: "테스트작가" }, provider: "kakao" });
    const { currentArtist } = await import("@/lib/artists");
    expect(await currentArtist()).toMatchObject({ userId, handle: HANDLE });
  });

  it("세션이 없으면 null", async () => {
    setSession(null);
    const { currentArtist } = await import("@/lib/artists");
    expect(await currentArtist()).toBeNull();
  });

  it("소셜이 아닌 세션(provider 없음)이면 null", async () => {
    setSession({ user: { id: userId } });
    const { currentArtist } = await import("@/lib/artists");
    expect(await currentArtist()).toBeNull();
  });

  it("currentMember alias는 currentArtist와 동일", async () => {
    const mod = await import("@/lib/artists");
    expect(mod.currentMember).toBe(mod.currentArtist);
  });
});

describe("publishedArtistId / searchArtists (handle 보유만 공개)", () => {
  it("handle 있는 프로필을 handle로 찾는다", async () => {
    const { publishedArtistId } = await import("@/lib/artists");
    expect(await publishedArtistId(HANDLE)).toBe(userId);
  });

  it("없는 handle이면 null", async () => {
    const { publishedArtistId } = await import("@/lib/artists");
    expect(await publishedArtistId(`no_${stamp}`.slice(0, 30))).toBeNull();
  });

  it("검색은 handle 보유자만 포함한다", async () => {
    const { searchArtists } = await import("@/lib/artists");
    const hits = await searchArtists(HANDLE);
    expect(hits.some((h) => h.userId === userId)).toBe(true);
    // otherUser는 handle 없음 → 검색에 안 잡힌다.
    expect(hits.some((h) => h.userId === otherUserId)).toBe(false);
  });
});
