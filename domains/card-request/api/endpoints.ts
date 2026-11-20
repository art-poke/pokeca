export const CARD_REQUEST_ENDPOINTS = {
  statuses: (cardId: string) => `/api/cards/${cardId}/requests`, // GET 현황 / POST {format} → 갱신된 현황
} as const;
