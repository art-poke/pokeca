const toCamel = (key: string): string =>
  key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/**
 * 객체/배열의 모든 KEY를 snake_case → camelCase로 재귀 변환한다. VALUE는 건드리지 않는다.
 *
 * 백엔드 응답(snake_case)을 Client 타입(camelCase)에 맞출 때 쓴다. 명시 타입 매핑이 있는
 * 도메인은 Transformer에서 필드별로 변환하므로 보통 필요 없고, envelope payload가 타입 없이
 * Record로 내려오는 경우(리치 콘텐츠 본문 등)에 일괄 변환용으로 쓴다.
 */
export const camelizeKeys = (input: unknown): unknown => {
  if (Array.isArray(input)) return input.map(camelizeKeys);
  if (input !== null && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, value]) => [
        toCamel(key),
        camelizeKeys(value),
      ]),
    );
  }
  return input;
};
