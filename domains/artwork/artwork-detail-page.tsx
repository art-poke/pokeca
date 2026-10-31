import { QueryClient, dehydrate } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { assertPrefetchState } from "@/lib/query/prefetch";
import { SafeHydrationBoundary } from "@/lib/query/safe-hydration-boundary";
import { fetchArtworkDetail } from "./api/actions";
import { artworkKeys } from "./api/queries";
import { ArtworkDetailClient } from "./components/artwork-detail-client";

// 서버컴포넌트. isMember는 상위(인증 레이어)에서 내려준다.
export const ArtworkDetailPage = async ({
  id,
  isMember,
}: {
  id: string;
  isMember: boolean;
}) => {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: artworkKeys.detail(id),
    queryFn: () => fetchArtworkDetail(id),
  });

  const error = assertPrefetchState(
    queryClient,
    artworkKeys.detail(id),
    "ArtworkDetailPage",
  );
  if (error) notFound();

  return (
    <SafeHydrationBoundary state={dehydrate(queryClient)}>
      <ArtworkDetailClient id={id} isMember={isMember} />
    </SafeHydrationBoundary>
  );
};
