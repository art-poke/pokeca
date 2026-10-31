// ---------------------------------------------------------------------------
// 에러코드 레지스트리 (SSOT)
//
// 서버는 code만 내려주고, 유저에게 보여줄 문구는 여기서 번역한다.
// 새 비즈니스 에러가 생기면 ① ErrorCode에 추가 ② ERROR_MESSAGES에 문구 추가. 끝.
// 컴포넌트/훅에 하드코딩된 토스트 문구를 두지 않는다.
// ---------------------------------------------------------------------------

export const ERROR_CODES = [
  // 공통
  "unauthorized", // 401 로그인 필요
  "forbidden", // 403 권한 없음
  "not_found", // 404
  "validation", // 400 입력값 오류
  "rate_limited", // 429
  "conflict", // 409 상태 충돌
  "internal", // 500 서버 오류
  "network", // 네트워크/타임아웃(클라에서 부여)

  // 도메인: artwork
  "already_downloaded", // 이미 다운로드해 추천이 반영됨
  "artwork_withdrawn", // 내려간 도안
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const GENERIC = "잠시 후 다시 시도해 주세요.";

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  unauthorized: "로그인 후 이용할 수 있어요.",
  forbidden: "권한이 없어요.",
  not_found: "찾을 수 없어요.",
  validation: "입력한 내용을 다시 확인해 주세요.",
  rate_limited: "요청이 많아요. 잠시 후 다시 시도해 주세요.",
  conflict: "지금은 처리할 수 없어요. 새로고침 후 다시 시도해 주세요.",
  internal: GENERIC,
  network: "네트워크 연결을 확인해 주세요.",
  already_downloaded: "이미 받은 도안이라 추천이 자동으로 반영돼 있어요.",
  artwork_withdrawn: "작가가 내린 도안이에요.",
};

/** code → 유저 문구. 모르는 code면 generic으로 떨어져 절대 빈 값/내부정보가 노출되지 않는다. */
export const getErrorMessage = (code: string | null | undefined): string => {
  if (code && code in ERROR_MESSAGES) return ERROR_MESSAGES[code as ErrorCode];
  return GENERIC;
};
