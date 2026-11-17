import { Skeleton } from "@/components/ui/skeleton";

export default function PlayLoading() {
  return (
    <div className="-my-6 flex h-[calc(100dvh-3.5rem)] gap-4 overflow-hidden md:-my-10">
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-2">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="min-h-0 flex-1 rounded-3xl" />
      </div>
      <aside className="hidden w-[320px] shrink-0 py-2 md:block">
        <Skeleton className="h-full rounded-2xl" />
      </aside>
    </div>
  );
}
