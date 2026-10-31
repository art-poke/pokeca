import { RankingListSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-64 rounded-3xl" />
      <RankingListSkeleton count={6} />
    </div>
  );
}
