import "server-only";
import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE, getBackendApiUrl } from "@/lib/auth/constants";
import { ServerFetchError, type ApiEnvelope } from "./envelope";

// ---------------------------------------------------------------------------
// ServerFetch — 서버 전용 백엔드 클라이언트 (BFF)
//
// - 모든 서버액션/서버컴포넌트 데이터 호출은 이 인스턴스를 거친다(raw fetch 금지).
// - httpOnly 쿠키의 AT를 자동으로 Bearer 헤더에 붙인다(JS에 토큰 노출 X).
// - 공통 envelope를 풀어 data만 반환하고, 실패면 ServerFetchError를 던진다.
// - AbortController 타임아웃으로 무한 대기를 막는다.
// ---------------------------------------------------------------------------

type RequestOptions = {
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /** 기본 10초. 느린 엔드포인트만 개별 지정. */
  timeout?: number;
  /** Next fetch 캐시 옵션 (서버컴포넌트 prefetch에서 revalidate 등). */
  next?: NextFetchRequestConfig;
  cache?: RequestCache;
};

const DEFAULT_TIMEOUT = 10_000;

const buildUrl = (path: string, params?: RequestOptions["params"]): string => {
  const base = `${getBackendApiUrl()}/${path.replace(/^\//, "")}`;
  if (!params) return base;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
};

const request = async <T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeout ?? DEFAULT_TIMEOUT,
  );

  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.params), {
      method,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      next: options.next,
      cache: options.cache,
    });
  } catch (e) {
    // 네트워크/타임아웃 — status 0으로 표준화해 던진다.
    throw new ServerFetchError(0, {
      error: { code: "network", message: (e as Error).message },
    });
  } finally {
    clearTimeout(timer);
  }

  const payload = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!res.ok || !payload || payload.ok === false) {
    throw new ServerFetchError(res.status, payload);
  }
  return payload.data;
};

export const serverApi = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, options),
  post: <T>(path: string, options?: RequestOptions) =>
    request<T>("POST", path, options),
  put: <T>(path: string, options?: RequestOptions) =>
    request<T>("PUT", path, options),
  patch: <T>(path: string, options?: RequestOptions) =>
    request<T>("PATCH", path, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, options),
};
