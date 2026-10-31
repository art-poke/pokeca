import type { ErrorCode } from "@/lib/api/error-codes";

// ---------------------------------------------------------------------------
// 서버액션 결과 규격 (쓰기 작업 전용)
//
// Next는 서버액션 경계에서 throw된 에러의 커스텀 필드(status, code)를 직렬화하며 날려버린다.
// 그래서 "쓰기" 액션은 에러를 throw하지 않고 이 평문 객체로 반환한다 → 클라가 code별로 분기해
// 유저친화 토스트를 띄울 수 있다. ("읽기" 쿼리는 그대로 throw해서 react-query가 처리한다)
// ---------------------------------------------------------------------------

export type ServerActionResult<T = void> =
  | { success: true; data: T }
  | {
      success: false;
      code: ErrorCode | null;
      retryable: boolean;
      status: number;
    };
