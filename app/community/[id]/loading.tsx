import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}
