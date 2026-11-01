import type { UploadArea } from "./types";

// 어드민 전용(작품 모더레이션).
export const ADMIN_ARTWORK_ENDPOINTS = {
  update: (id: string) => `/api/admin/artworks/${id}`, // PATCH
  files: (id: string) => `/api/admin/artworks/${id}/files`, // POST
} as const;

// 업로드 폼은 어드민/작가 공용 — area로 분기.
export const areaEndpoints = (area: UploadArea) => ({
  cards: (q: string) => `${area}/cards?q=${encodeURIComponent(q)}`, // GET
  artworks: `${area}/artworks`, // POST
});
