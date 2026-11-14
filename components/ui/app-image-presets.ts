export type AppImageVariant = "card" | "avatar" | "artwork" | "photo";

type Preset = { aspectRatio?: string; sizes: string; fit: "cover" | "contain" };

// variant가 비율·반응형 크기·채움 방식의 기본값을 정한다. 호출부는 variant만 고르면 된다.
export const APP_IMAGE_PRESETS: Record<AppImageVariant, Preset> = {
  card: {
    aspectRatio: "63 / 88",
    sizes: "(max-width:640px) 45vw, (max-width:1024px) 30vw, 220px",
    fit: "cover",
  },
  avatar: { aspectRatio: "1 / 1", sizes: "48px", fit: "cover" },
  // artwork은 비율 가변 → 호출부가 aspectRatio를 반드시 넘긴다(CLS=0 보장).
  artwork: { aspectRatio: undefined, sizes: "(max-width:768px) 100vw, 720px", fit: "contain" },
  photo: { aspectRatio: "4 / 3", sizes: "(max-width:768px) 100vw, 720px", fit: "cover" },
};

// 공개 CDN 전환 후 호스트를 채우면 <AppImage>가 next/image 최적화 경로로 바뀐다(현재는 전부 비최적화).
export const OPTIMIZABLE_HOSTS: readonly string[] = [];

export const isOptimizable = (src: string): boolean => {
  try {
    return OPTIMIZABLE_HOSTS.includes(new URL(src).host);
  } catch {
    return false; // 상대경로(/api/…) 등은 최적화 대상 아님
  }
};
