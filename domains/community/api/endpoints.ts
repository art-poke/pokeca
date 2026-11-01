export const COMMUNITY_ENDPOINTS = {
  createPost: "/api/community/posts", // POST → { id }
  removePost: (id: string) => `/api/community/posts/${id}`, // DELETE
} as const;
