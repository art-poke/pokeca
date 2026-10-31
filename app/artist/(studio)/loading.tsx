import { ArtworkGridSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row">
        <Skeleton className="h-56 rounded-2xl sm:w-64 sm:shrink-0" />
        <div className="grid flex-1 grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
      <Skeleton className="h-7 w-40" />
      <ArtworkGridSkeleton count={4} />
    </div>
  );
}
