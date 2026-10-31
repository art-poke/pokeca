"use client";

import {
  HydrationBoundary,
  useQueryClient,
  type DehydratedState,
} from "@tanstack/react-query";

/**
 * 서버 prefetch 데이터를 클라에 넘길 때, 이미 클라 캐시에 있는 쿼리는 덮어쓰지 않는다.
 * (무한스크롤로 여러 페이지 쌓인 상태에서 뒤로가기로 재진입 시 1페이지로 리셋되는 것 방지)
 */
export const SafeHydrationBoundary = ({
  state,
  children,
}: {
  state: DehydratedState;
  children: React.ReactNode;
}) => {
  const queryClient = useQueryClient();
  const filtered: DehydratedState = {
    ...state,
    queries: state.queries.filter(
      (q) => queryClient.getQueryData(q.queryKey) === undefined,
    ),
  };
  return <HydrationBoundary state={filtered}>{children}</HydrationBoundary>;
};
