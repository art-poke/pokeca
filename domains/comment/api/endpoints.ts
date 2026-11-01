export const COMMENT_ENDPOINTS = {
  create: "/api/comments", // POST
  remove: (id: string) => `/api/comments/${id}`, // DELETE
} as const;
