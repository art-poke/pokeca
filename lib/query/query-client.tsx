"use client";

import { useState } from "react";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { isApiError } from "@/lib/api/errors";
import { showErrorToast } from "@/lib/toast/gr-toast";
import { captureClientError } from "./telemetry";

// ---------------------------------------------------------------------------
// QueryClient 전역 설정 — "어떤 경우에도 화면이 멈추지 않는다"의 중심.
//
// - throwOnError 기본 false: 쿼리 실패가 트리를 터뜨리지 않고, 컴포넌트가 에러 상태를
//   인라인으로 렌더한다(무한 스켈레톤/빈 화면 방지).
// - retry: 5xx/네트워크만 2회. 4xx(비즈니스/인증)는 재시도 무의미 → 즉시 중단.
// - mutationCache.onError: 전역 에러 토스트(catch-all). 단 meta.skipGlobalError면
//   도메인 훅이 code별로 직접 토스트(예: already_downloaded는 안내성 문구).
// ---------------------------------------------------------------------------

const is4xx = (error: unknown): boolean =>
  isApiError(error) && error.status >= 400 && error.status < 500;

const makeQueryClient = () =>
  new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) =>
        captureClientError(error, { layer: "query", queryKey: query.queryKey }),
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        if (!mutation.meta?.skipGlobalError) {
          showErrorToast(isApiError(error) ? error.code ?? undefined : undefined);
        }
        captureClientError(error, { layer: "mutation", ...mutation.meta });
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: (failureCount, error) => (is4xx(error) ? false : failureCount < 2),
        refetchOnWindowFocus: false,
        throwOnError: false,
      },
      mutations: {
        throwOnError: false,
      },
    },
  });

let browserQueryClient: QueryClient | undefined;

// 서버: 요청마다 새로. 브라우저: 싱글턴(재마운트에도 캐시 유지).
const getQueryClient = () => {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
};

export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(getQueryClient);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};
