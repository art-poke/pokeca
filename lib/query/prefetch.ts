import "server-only";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { captureServerError } from "./telemetry";

/**
 * 서버컴포넌트 prefetch의 성공 여부를 "throw 없이" 확인한다.
 *
 * 서버컴포넌트에서 throw하면 RSC 스트리밍이 깨져 화면 전체가 멈춘다. 대신 이 함수로 상태를
 * 확인하고, 에러면 page가 스켈레톤/폴백을 렌더하도록 한다.
 *
 * @returns 에러가 있으면 그 에러, 없으면 null
 */
export const assertPrefetchState = (
  queryClient: QueryClient,
  queryKey: QueryKey,
  component: string,
): unknown => {
  const state = queryClient.getQueryState(queryKey);
  if (state?.status === "error") {
    captureServerError(state.error, { layer: "prefetch", component, queryKey });
    return state.error;
  }
  return null;
};
