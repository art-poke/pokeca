// 카드 이미지 URL을 언어/출처에 맞게 만든다. 클라이언트·서버 공용(서버전용 import 금지).
//  - ko: 공식 한글판 이미지(S3 uploads 버킷 cards/…) → /api/card-images
//  - ja: SNKRDUNK 일어판 이미지(현재 로컬 .cache, 추후 S3) → /api/jp-card-images
export function cardImageUrl(imagePath: string, lang?: string | null): string {
  if (lang === "ja") return `/api/jp-card-images/${imagePath}`;
  return `/api/card-images/${imagePath.replace(/^cards\//, "")}`;
}
