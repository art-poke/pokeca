// Query Key Factory — 계층형. prefetch와 client query가 같은 키를 공유한다.
// 무효화도 트리로: artworkKeys.detail(id) → 그 작품만, artworkKeys.all → 전부.
export const artworkKeys = {
  all: ["artworks"] as const,
  lists: () => [...artworkKeys.all, "list"] as const,
  /** cardId 없으면 홈 최신 피드. */
  list: (cardId?: string) => [...artworkKeys.lists(), cardId ?? "recent"] as const,
  details: () => [...artworkKeys.all, "detail"] as const,
  detail: (id: string) => [...artworkKeys.details(), id] as const,
};
