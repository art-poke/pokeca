export const CARD_SEARCH_ENDPOINTS = {
  page: (q: string, offset: number) =>
    `/api/search?q=${encodeURIComponent(q)}&offset=${offset}`, // GET → { hits, hasMore }
} as const;
