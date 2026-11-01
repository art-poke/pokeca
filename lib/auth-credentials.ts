import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

// 이메일·비밀번호를 확인한다. 맞으면 {id,email}, 틀리거나 없으면 null.
// Credentials authorize(auth.ts)와 통합 테스트가 함께 쓴다. next-auth를 끌어오지 않도록 분리했다.
export const verifyAdminCredentials = async (
  rawEmail: unknown,
  rawPassword: unknown,
): Promise<{ id: string; email: string } | null> => {
  const email = String(rawEmail ?? "").trim().toLowerCase();
  const password = String(rawPassword ?? "");
  if (!email || !password) return null;
  const rows = await db
    .select({ id: users.id, email: users.email, hash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const u = rows[0];
  if (!u?.hash || !u.email) return null;
  if (!(await bcrypt.compare(password, u.hash))) return null;
  return { id: u.id, email: u.email };
};
