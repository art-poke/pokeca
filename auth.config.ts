import type { NextAuthConfig } from "next-auth";
import Kakao from "next-auth/providers/kakao";
import Google from "next-auth/providers/google";

// edge-safe 설정: OAuth 프로바이더와 콜백만. db/bcrypt/adapter 같은 node 전용 import 금지.
// Credentials 프로바이더와 DrizzleAdapter는 node 전용인 auth.ts에서 더한다.
export const authConfig = {
  providers: [Kakao, Google],
  session: { strategy: "jwt" },
  // 작가 OAuth 기본 로그인 페이지일 뿐이다. 영역별 로그인 리다이렉트(어드민 → /admin/login)는 proxy.ts가 한다.
  pages: { signIn: "/artist/login" },
  callbacks: {
    async jwt({ token, account }) {
      if (account) token.provider = account.provider;
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      (session as { provider?: string }).provider = token.provider;
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
