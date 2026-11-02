import type { DefaultSession } from "next-auth";

// declare module 보강은 interface가 필수라 레포의 "type over interface" 규칙의 허용 예외다.
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    provider?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    provider?: string;
  }
}

// next-auth/jwt는 @auth/core/jwt를 재노출한다. 콜백 토큰 타입은 후자를 보므로 함께 보강한다.
declare module "@auth/core/jwt" {
  interface JWT {
    provider?: string;
  }
}
