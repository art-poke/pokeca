import { describe, it, expect } from "vitest";
import {
  validateScoreSubmission,
  MAX_SCORE_PER_BALL,
  type ValidationResult,
} from "@/domains/game/validation";

const ok = { score: 120, ballsPlaced: 40, maxTier: 6, durationMs: 60_000 };
const reasonOf = (r: ValidationResult): string | null => (r.ok ? null : r.reason);

describe("validateScoreSubmission", () => {
  it("accepts a plausible payload", () => {
    expect(validateScoreSubmission(ok)).toEqual({ ok: true });
  });

  it("rejects non-object / missing fields", () => {
    expect(validateScoreSubmission(null).ok).toBe(false);
    expect(validateScoreSubmission({ score: 1 }).ok).toBe(false);
    expect(validateScoreSubmission({ ...ok, score: "x" }).ok).toBe(false);
  });

  it("rejects negative or non-integer score", () => {
    expect(validateScoreSubmission({ ...ok, score: -1 }).ok).toBe(false);
    expect(validateScoreSubmission({ ...ok, score: 1.5 }).ok).toBe(false);
  });

  it("rejects score above the per-ball plausibility cap", () => {
    const tooHigh = { ...ok, ballsPlaced: 10, score: 10 * MAX_SCORE_PER_BALL + 1 };
    expect(validateScoreSubmission(tooHigh)).toEqual({ ok: false, reason: "score_out_of_range" });
  });

  it("accepts score exactly at the cap", () => {
    const atCap = { ...ok, ballsPlaced: 10, score: 10 * MAX_SCORE_PER_BALL };
    expect(validateScoreSubmission(atCap).ok).toBe(true);
  });

  it("rejects out-of-range duration", () => {
    expect(reasonOf(validateScoreSubmission({ ...ok, durationMs: 2_999 }))).toBe("duration_out_of_range");
    expect(reasonOf(validateScoreSubmission({ ...ok, durationMs: 7_200_001 }))).toBe("duration_out_of_range");
  });

  it("rejects out-of-range ballsPlaced", () => {
    expect(reasonOf(validateScoreSubmission({ ...ok, ballsPlaced: 0, score: 0 }))).toBe("balls_out_of_range");
    expect(reasonOf(validateScoreSubmission({ ...ok, ballsPlaced: 100_001 }))).toBe("balls_out_of_range");
  });

  it("rejects out-of-range maxTier", () => {
    expect(reasonOf(validateScoreSubmission({ ...ok, maxTier: 0 }))).toBe("tier_out_of_range");
    expect(reasonOf(validateScoreSubmission({ ...ok, maxTier: 12 }))).toBe("tier_out_of_range");
  });
});
