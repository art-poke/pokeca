import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";
import { authConfig } from "@/auth.config";
import { verifyAdminCredentials } from "@/lib/auth-credentials";

export { verifyAdminCredentials };

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // 커스텀 스키마: 아래 두 테이블의 일부 컬럼만 어댑터 기본 타입과 달라, 그 테이블만 좁혀 캐스팅한다.
  // usersTable·verificationTokensTable은 타입 검사를 그대로 유지한다(잘못된 테이블 매핑을 막는다).
  //   - accounts.expires_at: bigint vs 어댑터 integer
  //   - sessions.sessionToken: text unique vs 어댑터 pk
  // (users.id / accounts.userId의 uuid vs text 차이도 여기 포함된다.)
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accountsTable: accounts as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionsTable: sessions as any,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: (creds) => verifyAdminCredentials(creds?.email, creds?.password),
    }),
  ],
});
