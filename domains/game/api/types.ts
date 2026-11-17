// game 도메인 클라 타입. lib/game.ts의 구조와 일치(서버-클라 계약). server-only 모듈은 import하지 않는다.

export type LeaderboardScope = "all" | "month";

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  image: string | null;
  score: number;
};

export type LeaderboardResult = {
  entries: LeaderboardEntry[];
  me: { rank: number; score: number } | null;
};

// 게임오버 시 서버로 보내는 제출 payload.
export type ScoreSubmission = {
  score: number;
  ballsPlaced: number;
  maxTier: number;
  durationMs: number;
};

export type SubmitScoreResult = { id: string };
