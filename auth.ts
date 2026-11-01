import NextAuth from "next-auth";
import type { Adapter } from "next-auth/adapters";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";
import { authConfig } from "@/auth.config";
import { verifyAdminCredentials } from "@/lib/auth-credentials";

export { verifyAdminCredentials };

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // 커스텀 스키마 타입: DrizzleAdapter의 기본 컬럼 형태(expires_at=integer, sessionToken=pk)와
  // 우리 SQL 거울(bigint, text unique)이 달라 타입만 어긋난다. 런타임은 맞으므로 결과만 Adapter로 좁힌다.
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as Adapter,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: (creds) => verifyAdminCredentials(creds?.email, creds?.password),
    }),
  ],
});
