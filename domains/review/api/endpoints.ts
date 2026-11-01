export const REVIEW_ENDPOINTS = {
  create: "/api/reviews", // POST
  remove: (id: string) => `/api/reviews/${id}`, // DELETE
} as const;
