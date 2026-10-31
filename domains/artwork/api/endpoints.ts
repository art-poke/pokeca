// artwork 도메인 엔드포인트. 하드코딩 금지 — 호출은 전부 이 상수를 거친다.
const ARTWORKS = "api/v1/artworks";

export const ARTWORK_ENDPOINTS = {
  list: ARTWORKS,
  detail: (id: string) => `${ARTWORKS}/${id}`,
  recommend: (id: string) => `${ARTWORKS}/${id}/recommend`,
} as const;
