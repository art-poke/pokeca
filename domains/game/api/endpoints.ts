// game 도메인 엔드포인트. 하드코딩 금지 — 쓰기 호출은 이 상수를 거친다.
export const GAME_ENDPOINTS = {
  score: "/api/game/score", // POST 점수제출 / GET ?scope=all|month 리더보드
} as const;
