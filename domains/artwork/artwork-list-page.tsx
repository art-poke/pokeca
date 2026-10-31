import { QueryClient, dehydrate } from "@tanstack/react-query";
import { assertPrefetchState } from "@/lib/query/prefetch";
import { SafeHydrationBoundary } from "@/lib/query/safe-hydration-boundary";
import { fetchArtworks } from "./api/actions";
import { artworkKeys } from "./api/queries";
import type { ArtworkCursor } from "./api/types";
import { ArtworkListClient } from "./components/artwork-list-client";

// 서버컴포넌트. 1페이지를 서버에서 prefetch → dehydrate → 클라가 이어받는다.
// prefetch가 실패해도 throw하지 않고 클라에서 재시도(화면 안 멈춤).
export const ArtworkListPage = async ({ cardId }: { cardId?: string } = {}) => {
  const queryClient = new QueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey: artworkKeys.list(cardId),
    queryFn: () => fetchArtworks(cardId),
    initialPageParam: undefined as ArtworkCursor | undefined,
  });

  const error = assertPrefetchState(
    queryClient,
    artworkKeys.list(cardId),
    "ArtworkListPage",
  );
  if (error) return <ArtworkListClient cardId={cardId} />;

  return (
    <SafeHydrationBoundary state={dehydrate(queryClient)}>
      <ArtworkListClient cardId={cardId} />
    </SafeHydrationBoundary>
  );
};
