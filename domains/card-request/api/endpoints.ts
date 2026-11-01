export const CARD_REQUEST_ENDPOINTS = {
  statuses: (cardId: string) => `/api/cards/${cardId}/requests`, // GET 현황 / POST {format} → 갱신된 현황
  request: (cardId: string) => `/api/cards/${cardId}/request`, // POST {format} (단건 요청)
} as const;
