import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";

// @/auth는 node 전용 next-auth를 끌어와 테스트 환경에서 import가 깨진다(admin 테스트와 동일).
// 전체를 모킹하고 세션은 테스트마다 setSession으로 바꾼다.
const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: authMock, signIn: vi.fn(), signOut: vi.fn() }));
const setSession = (value: unknown) => authMock.mockResolvedValue(value);

// 로컬 Docker Postgres(DATABASE_URL)에 직접 붙어, C1b에서 Drizzle로 전환한
// artists/members 함수를 검증한다(auth.test.ts와 같은 DB 셋업).
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const stamp = Date.now();
const EMAIL = `artist-auth-test-${stamp}@pokeca.local`;
const HANDLE = `t_${stamp}`;
const OTHER_EMAIL = `artist-auth-test-other-${stamp}@pokeca.local`;
const MEMBER_EMAIL = `member-auth-test-${stamp}@pokeca.local`;

let userId: string;
let otherUserId: string;
let memberUserId: string;

async function makeUser(email: string): Promise<string> {
  const u = await pool.query(`insert into users (email) values ($1) returning id`, [email]);
  return u.rows[0].id;
}

beforeAll(async () => {
  userId = await makeUser(EMAIL);
  otherUserId = await makeUser(OTHER_EMAIL);
  memberUserId = await makeUser(MEMBER_EMAIL);
});

beforeEach(() => setSession(null));

afterAll(async () => {
  // users on delete cascade로 artists/members 행도 함께 지워진다.
  await pool.query(`delete from users where id = any($1::uuid[])`, [[userId, otherUserId, memberUserId]]);
  await pool.end();
});

const social = (id: string, email: string) => ({
  id,
  email,
  provider: "kakao" as const,
  name: "테스트작가",
});

describe("registerArtist (Drizzle)", () => {
  it("작가를 넣고 매핑된 모양을 돌려준다", async () => {
    const { registerArtist } = await import("@/lib/artists");
    const artist = await registerArtist(social(userId, EMAIL), {
      handle: HANDLE,
      displayName: "테스트 작가",
      intro: "소개글",
      linkUrl: "https://example.com",
    });
    expect(artist).toMatchObject({
      userId,
      handle: HANDLE,
      displayName: "테스트 작가",
      email: EMAIL,
      provider: "kakao",
      intro: "소개글",
      linkUrl: "https://example.com",
      status: "pending",
    });
    expect(typeof artist.createdAt).toBe("string");
    expect(Number.isNaN(Date.parse(artist.createdAt))).toBe(false);
  });

  it("같은 유저가 또 신청하면 already_registered (ArtistError)", async () => {
    const { registerArtist, ArtistError } = await import("@/lib/artists");
    const err = await registerArtist(social(userId, EMAIL), { handle: `${HANDLE}x`, displayName: "또 나" }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(ArtistError);
    expect(err).toMatchObject({ code: "already_registered" });
  });

  it("핸들이 겹치면(다른 유저) handle_taken", async () => {
    const { registerArtist } = await import("@/lib/artists");
    await expect(
      registerArtist(social(otherUserId, OTHER_EMAIL), { handle: HANDLE, displayName: "다른 작가" }),
    ).rejects.toMatchObject({ code: "handle_taken" });
  });
});

describe("getArtistById / artistByUserId 왕복", () => {
  it("getArtistById가 넣은 작가를 그대로 돌려준다", async () => {
    const { getArtistById } = await import("@/lib/artists");
    const artist = await getArtistById(userId);
    expect(artist).toMatchObject({ userId, handle: HANDLE, status: "pending" });
  });

  it("없는 유저면 null", async () => {
    const { getArtistById } = await import("@/lib/artists");
    expect(await getArtistById(crypto.randomUUID())).toBeNull();
  });
});

describe("currentArtist (세션 모킹)", () => {
  it("소셜 세션이 작가면 작가를 돌려준다", async () => {
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
});

describe("currentMember (Drizzle, 자동 생성)", () => {
  it("member 행이 없으면 소셜 이름으로 만들고 돌려준다", async () => {
    setSession({ user: { id: memberUserId, email: MEMBER_EMAIL, name: "새 회원" }, provider: "google" });
    const { currentMember } = await import("@/lib/members");
    const member = await currentMember();
    expect(member).toMatchObject({ userId: memberUserId, nickname: "새 회원", displayName: "새 회원", avatarPath: null });
    // DB에 실제로 행이 생겼는지 확인.
    const row = await pool.query(`select nickname from members where user_id = $1`, [memberUserId]);
    expect(row.rows[0]?.nickname).toBe("새 회원");
  });

  it("세션이 없으면 null", async () => {
    setSession(null);
    const { currentMember } = await import("@/lib/members");
    expect(await currentMember()).toBeNull();
  });
});
