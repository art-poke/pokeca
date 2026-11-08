"use client";

import type { ReactNode } from "react";
import { signOut } from "next-auth/react";

// 로그아웃은 반드시 Auth.js 엔드포인트(/api/auth/signout)로 보낸다.
// 서버액션 signOut()을 쓰면 proxy.ts 미들웨어(auth 래퍼)가 같은 응답에서 세션 쿠키를
// refresh(재발급)해 삭제 Set-Cookie를 덮어써 로그아웃이 안 됐다(프로드 버그).
// matcher에서 /api/auth를 제외하고 이 엔드포인트를 경유해 미들웨어 refresh를 피한다.
export const SignOutButton = ({
  callbackUrl,
  className,
  children = "로그아웃",
}: {
  callbackUrl: string;
  className?: string;
  children?: ReactNode;
}) => (
  <button type="button" className={className} onClick={() => signOut({ callbackUrl })}>
    {children}
  </button>
);
