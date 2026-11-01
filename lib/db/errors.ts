import "server-only";

// Drizzle는 pg 에러를 DrizzleQueryError로 감싸 실제 pg 에러를 `.cause`에 둔다.
// cause 체인을 따라가며 pg SQLSTATE 코드(예: "23505" unique_violation)를 찾는다.
export const pgErrorCode = (e: unknown): string | undefined => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = e;
  for (let i = 0; i < 5 && cur; i++) {
    if (typeof cur.code === "string") return cur.code;
    cur = cur.cause;
  }
  return undefined;
};

export const isUniqueViolation = (e: unknown): boolean => pgErrorCode(e) === "23505";
