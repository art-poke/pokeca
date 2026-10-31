import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// 화면별 로딩 스켈레톤. 실제 콘텐츠와 같은 형태라 로딩→렌더 전환이 매끄럽다.

const card = "rounded-2xl border border-border bg-background";

// 도안 타일(카드 비율) + 제목/작가 줄.
export function ArtworkTileSkeleton() {
  return (
    <div className={cn("overflow-hidden", card)}>
      <Skeleton className="aspect-[63/88] w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function ArtworkGridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <ArtworkTileSkeleton />
        </li>
      ))}
    </ul>
  );
}

// 리스트(행) 스켈레톤: 커뮤니티 글/도안 요청 등.
export function RowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className={cn("divide-y divide-border overflow-hidden", card)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="size-6 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// 카드 상세: 헤더 + 규격 필터 + 도안 그리드.
export function CardPageSkeleton() {
  return (
    <div className="space-y-8">
      <div className={cn("flex items-stretch gap-4 p-4 md:gap-6 md:p-6", card)}>
        <Skeleton className="hidden aspect-[63/88] w-28 shrink-0 rounded-xl sm:block md:w-32" />
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-10 w-40 rounded-xl" />
        </div>
      </div>
      <ArtworkGridSkeleton count={6} />
    </div>
  );
}

// 도안 상세: 큰 이미지 + 우측 정보/버튼.
export function ArtworkDetailSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-4 w-40" />
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="aspect-[63/88] max-h-[70vh] w-full rounded-2xl" />
        <div className="space-y-5">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// 작가 공개 페이지: 프로필 헤더 + 갤러리.
export function ArtistPageSkeleton() {
  return (
    <div className="space-y-8">
      <div className={cn("flex items-start gap-4 p-5 md:gap-5 md:p-6", card)}>
        <Skeleton className="size-16 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-6 w-40" />
      <ArtworkGridSkeleton count={4} />
    </div>
  );
}

// 작가 랭킹 리스트(홈 사이드/랭킹 페이지).
export function RankingListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="size-9 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
