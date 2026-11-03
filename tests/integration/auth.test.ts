import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

// currentAdmin의 connection()(동적 렌더 강제)은 요청 스코프 밖에선 던진다 → no-op 모킹.
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  connection: async () => {},
}));

// 로컬 Docker Postgres(DATABASE_URL)에 직접 붙어 어드민을 심고, Credentials 검증과 currentAdmin을 확인한다.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const EMAIL = `auth-test-admin-${Date.now()}@pokeca.local`;
const PASSWORD = "testpw1234";
let adminId: string;

beforeAll(async () => {
  const hash = await bcrypt.hash(PASSWORD, 12);
  const u = await pool.query(
    `insert into users (email, password_hash) values ($1, $2)
     on conflict (email) do update set password_hash = excluded.password_hash
     returning id`,
    [EMAIL, hash],
  );
  adminId = u.rows[0].id;
  await pool.query(
    `insert into admins (user_id, email) values ($1, $2) on conflict (user_id) do nothing`,
    [adminId, EMAIL],
  );
});

afterAll(async () => {
  await pool.query(`delete from users where id = $1`, [adminId]); // admins는 on delete cascade로 함께 지워진다.
  await pool.end();
});

describe("credentials 검증 (verifyAdminCredentials)", () => {
  it("비밀번호가 맞으면 {id,email}을 돌려준다", async () => {
    const { verifyAdminCredentials } = await import("@/lib/auth-credentials");
    expect(await verifyAdminCredentials(EMAIL, PASSWORD)).toEqual({ id: adminId, email: EMAIL });
  });

  it("대소문자·앞뒤 공백을 정규화해 이메일을 맞춘다", async () => {
    const { verifyAdminCredentials } = await import("@/lib/auth-credentials");
    expect(await verifyAdminCredentials(`  ${EMAIL.toUpperCase()} `, PASSWORD)).toEqual({
      id: adminId,
      email: EMAIL,
    });
  });

  it("비밀번호가 틀리면 null", async () => {
    const { verifyAdminCredentials } = await import("@/lib/auth-credentials");
    expect(await verifyAdminCredentials(EMAIL, "wrong-password")).toBeNull();
  });

  it("없는 이메일이면 null", async () => {
    const { verifyAdminCredentials } = await import("@/lib/auth-credentials");
    expect(await verifyAdminCredentials("nobody@pokeca.local", PASSWORD)).toBeNull();
  });

  it("빈 입력이면 null", async () => {
    const { verifyAdminCredentials } = await import("@/lib/auth-credentials");
    expect(await verifyAdminCredentials("", "")).toBeNull();
  });
});

describe("currentAdmin (세션 → admins 허용 목록)", () => {
  it("세션이 어드민 유저면 admin을 돌려준다", async () => {
    vi.doMock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: adminId } }) }));
    const { currentAdmin } = await import("@/lib/admin");
    expect(await currentAdmin()).toEqual({ userId: adminId, email: EMAIL });
    vi.doUnmock("@/auth");
    vi.resetModules();
  });

  it("어드민이 아닌 유저면 null", async () => {
    const stranger = crypto.randomUUID();
    vi.doMock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: stranger } }) }));
    const { currentAdmin } = await import("@/lib/admin");
    expect(await currentAdmin()).toBeNull();
    vi.doUnmock("@/auth");
    vi.resetModules();
  });

  it("세션이 없으면 null", async () => {
    vi.doMock("@/auth", () => ({ auth: vi.fn().mockResolvedValue(null) }));
    const { currentAdmin } = await import("@/lib/admin");
    expect(await currentAdmin()).toBeNull();
    vi.doUnmock("@/auth");
    vi.resetModules();
  });
});
