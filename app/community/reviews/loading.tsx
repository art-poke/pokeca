import { RowsSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-10 w-72 rounded-xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-6 w-28" />
      <RowsSkeleton count={4} />
    </div>
  );
}
