import { cn } from "@/lib/utils";

// 로딩 placeholder. 쉬머(globals.css @utility skeleton) + 호출부에서 크기·radius 지정.
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-md", className)} />;
}
