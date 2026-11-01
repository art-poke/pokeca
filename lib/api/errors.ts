import type { ErrorCode } from "./error-codes";

// 같은 Next의 API route는 실패 시 `{ code }` + HTTP status를 준다(adminRoute/memberRoute 규격).
// 그걸 담아 던지는 에러. 호출자(뮤테이션 등)가 code별로 유저 문구를 분기한다.
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | null;

  constructor(code: string | null, status: number) {
    super(code ?? `http_${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = (code as ErrorCode | null) ?? null;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
