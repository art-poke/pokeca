import { ApiError } from "./errors";

// ---------------------------------------------------------------------------
// 같은 Next의 API route(/api/*)를 호출하는 클라이언트 fetch. (별도 백엔드 아님)
//
// 클라이언트 react-query 훅의 queryFn/mutationFn에서 쓴다. 실패하면 route가 준 { code }를
// 담아 ApiError로 던지므로, 호출자는 code별로 유저 문구를 분기할 수 있다.
// (서버컴포넌트 prefetch는 lib/*를 직접 부른다 — 여긴 안 거침)
// ---------------------------------------------------------------------------

export const apiFetch = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { code?: string } | null;
    throw new ApiError(body?.code ?? null, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
};
