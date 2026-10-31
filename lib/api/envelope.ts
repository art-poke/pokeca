import type { ErrorCode } from "./error-codes";

// ---------------------------------------------------------------------------
// 백엔드 공통 응답 규격 (별도 API 서버와의 계약)
//
// 성공: { ok: true, data }
// 실패: { ok: false, error: { code, message, retryable } }
//
// 모든 엔드포인트가 이 모양을 지킨다. 프론트는 이 규격만 믿고 처리하면 되므로
// "API가 어떤 식으로든 뻑나서 화면이 멈추는" 경우를 구조적으로 없앤다.
// ---------------------------------------------------------------------------

export type ApiErrorBody = {
  /** 조직 표준 에러코드. 프론트가 유저 문구로 번역한다(error-codes.ts). */
  code: ErrorCode;
  /** 서버가 주는 설명(디버그/로그용). 유저에게 그대로 노출하지 않는다. */
  message?: string;
  /** 서버가 계산해 내려주는 재요청 가능 여부. FE가 code별로 직접 매핑하지 않는다. */
  retryable?: boolean;
};

export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorBody };

/**
 * HTTP 레벨에서 실패(4xx/5xx)했을 때 던지는 에러.
 * status와 파싱된 응답 body(에러 envelope)를 보존한다 — 호출자가 code별로 분기한다.
 */
export class ServerFetchError extends Error {
  readonly status: number;
  readonly code: ErrorCode | null;
  readonly retryable: boolean;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    const error =
      body && typeof body === "object" && "error" in body
        ? (body as { error?: ApiErrorBody }).error
        : undefined;
    super(error?.code ?? `http_${status}`);
    this.name = "ServerFetchError";
    this.status = status;
    this.code = (error?.code as ErrorCode | undefined) ?? null;
    this.retryable = error?.retryable ?? status >= 500;
    this.body = body;
  }
}

export const isServerFetchError = (e: unknown): e is ServerFetchError =>
  e instanceof ServerFetchError;
