import { PokeballMark } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import type { AppImageVariant } from "./app-image-presets";

// 이미지가 없거나 로드 실패했을 때 보여주는 중립 자리. 브라우저 깨진-아이콘/alt 노출 금지.
// 색·여백은 DESIGN 토큰만. 카드처럼 더 풍부한 폴백이 필요하면 <AppImage fallback=…>로 교체한다.
export const AppImageFallback = ({
  variant,
  label,
  className,
}: {
  variant: AppImageVariant;
  label?: string;
  className?: string;
}) => {
  if (variant === "avatar") {
    return (
      <div
        className={cn(
          "flex size-full items-center justify-center bg-gray-100 text-ink-500",
          className,
        )}
        aria-hidden
      >
        <span className="text-sm font-bold">{label?.trim()?.[0]?.toUpperCase() ?? "?"}</span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex size-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200",
        className,
      )}
      aria-hidden
    >
      <PokeballMark className="size-10 opacity-20" />
    </div>
  );
};
