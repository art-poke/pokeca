// ---------------------------------------------------------------------------
// 인증/백엔드 상수 (SSOT)
//
// 토큰 관리 설계: AT/RT 모두 httpOnly 쿠키. 브라우저 JS는 토큰을 못 본다(BFF).
// Next 서버(서버액션·미들웨어)만 쿠키를 읽어 백엔드에 Bearer로 붙인다.
// 토큰 갱신(refresh)은 미들웨어(proxy.ts)가 선제적으로 처리한다.
// ---------------------------------------------------------------------------

/** 액세스 토큰 쿠키 이름 (httpOnly). 서버만 읽는다. */
export const ACCESS_TOKEN_COOKIE = "at";

/** 리프레시 토큰 쿠키 이름 (httpOnly, path 제한). 미들웨어만 읽는다. */
export const REFRESH_TOKEN_COOKIE = "rt";

/** 별도 백엔드 API의 base URL. 서버 전용 — NEXT_PUBLIC_ 접두사 금지(토큰이 서버에서만 붙으므로). */
export const getBackendApiUrl = (): string => {
  const url = process.env.BACKEND_API_URL;
  if (!url) throw new Error("BACKEND_API_URL must be set");
  return url.replace(/\/$/, "");
};
