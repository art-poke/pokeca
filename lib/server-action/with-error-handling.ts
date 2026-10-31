import { isServerFetchError } from "@/lib/api/envelope";
import { captureServerError } from "@/lib/query/telemetry";
import type { ServerActionResult } from "./types";

/**
 * 쓰기 서버액션을 감싸 ServerFetchError를 평문 결과 객체로 바꾸는 HOF.
 *
 * @example
 *   const _toggleRecommend = async (id: string) => {
 *     return serverApi.post<{ recommended: boolean }>(`...`);
 *   };
 *   export const toggleRecommend = withErrorHandling(_toggleRecommend);
 *
 *   // mutation에서: result.success 분기 → 실패면 result.code로 유저 문구
 */
export const withErrorHandling = <TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
) => {
  return async (...args: TArgs): Promise<ServerActionResult<TReturn>> => {
    try {
      const data = await fn(...args);
      return { success: true, data };
    } catch (error) {
      if (isServerFetchError(error)) {
        // 5xx/네트워크(예상 못한 실패)만 캡처. 4xx 비즈니스 거부는 노이즈라 제외.
        if (error.status >= 500 || error.status === 0) {
          captureServerError(error, { layer: "server-action", status: error.status });
        }
        return {
          success: false,
          code: error.code,
          retryable: error.retryable,
          status: error.status,
        };
      }
      // ServerFetchError가 아닌 예상 못한 에러는 항상 캡처.
      captureServerError(error, { layer: "server-action" });
      return { success: false, code: "internal", retryable: false, status: 0 };
    }
  };
};
