import { QueryClient, dehydrate } from "@tanstack/react-query";
import { assertPrefetchState } from "@/lib/query/prefetch";
import { SafeHydrationBoundary } from "@/lib/query/safe-hydration-boundary";
import { fetchRecentArtworks } from "./api/actions";
import { artworkKeys } from "./api/queries";
import { ArtworkListClient } from "./components/artwork-list-client";

// 서버컴포넌트. 목록을 서버에서 prefetch(lib 직접 호출) → dehydrate → 클라가 이어받는다.
// prefetch 실패해도 throw하지 않고 클라에서 재시도(화면 안 멈춤).
export const ArtworkListPage = async ({ limit }: { limit?: number } = {}) => {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: artworkKeys.list(),
    queryFn: () => fetchRecentArtworks(limit),
  });

  const error = assertPrefetchState(queryClient, artworkKeys.list(), "ArtworkListPage");
  if (error) return <ArtworkListClient limit={limit} />;

  return (
    <SafeHydrationBoundary state={dehydrate(queryClient)}>
      <ArtworkListClient limit={limit} />
    </SafeHydrationBoundary>
  );
};
