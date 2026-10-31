// ---------------------------------------------------------------------------
// 에러 텔레메트리 (플러그인 포인트)
//
// 지금은 콘솔 로깅. 나중에 Sentry 등을 붙일 때 이 두 함수의 몸통만 교체하면
// 전 레이어(쿼리/뮤테이션/서버액션)의 캡처가 한 번에 바뀐다.
// ---------------------------------------------------------------------------

type Context = Record<string, unknown>;

export const captureServerError = (error: unknown, context?: Context) => {
  console.error("[server-error]", context ?? {}, error);
};

export const captureClientError = (error: unknown, context?: Context) => {
  console.error("[client-error]", context ?? {}, error);
};
