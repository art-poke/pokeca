import { RowsSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-6 w-40" />
      <RowsSkeleton count={4} />
    </div>
  );
}
