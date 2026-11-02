import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright가 127.0.0.1로 개발 서버에 붙는다.
  allowedDevOrigins: ["127.0.0.1"],
  // cacheComponents(실험적 PPR)는 Auth.js auth()의 불안정값과 충돌해 작가/어드민 페이지에서
  // Suspense 실패 → 클라 리로드 무한루프를 유발한다. 꺼서 동적 렌더로 간다(인증 페이지는 어차피 동적).
  // cacheComponents: true,
  // partialPrefetching: true,
};

export default nextConfig;
