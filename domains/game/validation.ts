// 점수 제출 가벼운 검증(순수). 상금·보상 없는 순수 경쟁이므로 "그럴듯한 위조"까지는
// 막지 않고, 상식선(상한·플레이시간·범위)만 거른다. 빈도 제한은 route에서 DB로 처리.

import { MAX_TIER } from "./engine/ladder";

// 공 1개당 허용 최대 점수(= 최고 생성점수 55 + 마스터 팝 보너스 여유). 느슨한 heuristic cap.
export const MAX_SCORE_PER_BALL = 60;

export const MIN_DURATION_MS = 3_000;
export const MAX_DURATION_MS = 7_200_000; // 2시간
export const MAX_BALLS = 100_000;

export type ScorePayload = {
  score: number;
  ballsPlaced: number;
  maxTier: number;
  durationMs: number;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

export const validateScoreSubmission = (payload: unknown): ValidationResult => {
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, reason: "invalid_payload" };
  }
  const p = payload as Record<string, unknown>;
  if (!isInt(p.score) || !isInt(p.ballsPlaced) || !isInt(p.maxTier) || !isInt(p.durationMs)) {
    return { ok: false, reason: "invalid_payload" };
  }

  const { score, ballsPlaced, maxTier, durationMs } = p as ScorePayload;

  if (ballsPlaced < 1 || ballsPlaced > MAX_BALLS) {
    return { ok: false, reason: "balls_out_of_range" };
  }
  if (maxTier < 1 || maxTier > MAX_TIER) {
    return { ok: false, reason: "tier_out_of_range" };
  }
  if (durationMs < MIN_DURATION_MS || durationMs > MAX_DURATION_MS) {
    return { ok: false, reason: "duration_out_of_range" };
  }
  if (score < 0 || score > ballsPlaced * MAX_SCORE_PER_BALL) {
    return { ok: false, reason: "score_out_of_range" };
  }
  return { ok: true };
};
