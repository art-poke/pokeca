import { RowsSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-10 w-20 rounded-xl" />
      </div>
      <Skeleton className="h-10 w-72 rounded-xl" />
      <RowsSkeleton />
    </div>
  );
}
