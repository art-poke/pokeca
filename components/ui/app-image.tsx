"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppImageFallback } from "./app-image-fallback";
import { APP_IMAGE_PRESETS, type AppImageVariant } from "./app-image-presets";

type AppImageProps = {
  src: string | null | undefined;
  alt: string;
  variant?: AppImageVariant;
  sizes?: string; // 최적화(next/image) 전환 뒤 의미. 지금은 무해하게 무시된다.
  priority?: boolean; // 첫 화면 히어로/첫 줄만 true
  fit?: "cover" | "contain";
  aspectRatio?: string; // artwork는 필수
  fallback?: ReactNode; // 카드 set/number 같은 풍부한 폴백 override
  className?: string; // 바깥 박스
};

// 로딩=스켈레톤, 로드=페이드인, 실패/빈값=폴백. 바깥 aspect 박스로 자리를 선확보해 CLS=0.
// 지금은 plain <img>로 그린다(302 프록시·서명 URL 동작). CDN+next/image 전환 시 이 내부만 교체.
export const AppImage = ({
  src,
  alt,
  variant = "photo",
  sizes,
  priority = false,
  fit,
  aspectRatio,
  fallback,
  className,
}: AppImageProps) => {
  const preset = APP_IMAGE_PRESETS[variant];
  const ratio = aspectRatio ?? preset.aspectRatio;
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(src ? "loading" : "error");
  const showFallback = status === "error" || !src;

  return (
    <div
      className={cn("relative overflow-hidden bg-gray-100", className)}
      style={ratio ? { aspectRatio: ratio } : undefined}
    >
      {!showFallback && status === "loading" && <div className="skeleton absolute inset-0" aria-hidden />}
      {showFallback ? (
        (fallback ?? <AppImageFallback variant={variant} />)
      ) : (
        // next/image는 CDN+옵티마이저 전환 뒤 적용. 그 전엔 302/서명 URL을 plain img로 따라간다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          sizes={sizes ?? preset.sizes}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          className={cn(
            "absolute inset-0 size-full transition-opacity duration-300",
            (fit ?? preset.fit) === "contain" ? "object-contain" : "object-cover",
            status === "loaded" ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );
};
