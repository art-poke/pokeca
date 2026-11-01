// 같은 Next의 API route 경로. (별도 백엔드 아님)
export const FAVORITE_ENDPOINTS = {
  toggle: "/api/member/favorites", // POST { cardId } → { favorited }
} as const;
