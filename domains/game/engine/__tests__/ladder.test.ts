import { describe, it, expect } from "vitest";
import {
  TIERS,
  MAX_TIER,
  tierConfig,
  nextTier,
  droppableTiers,
  pickDropTier,
  DROP_WEIGHTS,
} from "@/domains/game/engine/ladder";

describe("ladder config", () => {
  it("has exactly 11 tiers numbered 1..11 in order", () => {
    expect(TIERS).toHaveLength(11);
    expect(MAX_TIER).toBe(11);
    TIERS.forEach((t, i) => expect(t.tier).toBe(i + 1));
  });

  it("radius is strictly monotonic increasing", () => {
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].radius).toBeGreaterThan(TIERS[i - 1].radius);
    }
  });

  it("score for tier T is the triangular number (T-1)*T/2, tier1 = 0", () => {
    for (const t of TIERS) {
      expect(t.score).toBe(((t.tier - 1) * t.tier) / 2);
    }
    expect(tierConfig(1).score).toBe(0);
    expect(tierConfig(11).score).toBe(55);
  });

  it("only tiers 1..5 are droppable", () => {
    expect(droppableTiers()).toEqual([1, 2, 3, 4, 5]);
    TIERS.forEach((t) => expect(t.droppable).toBe(t.tier <= 5));
  });

  it("nextTier returns T+1, or null at the top", () => {
    expect(nextTier(1)).toBe(2);
    expect(nextTier(10)).toBe(11);
    expect(nextTier(11)).toBeNull();
  });

  it("tierConfig throws out of range", () => {
    expect(() => tierConfig(0)).toThrow();
    expect(() => tierConfig(12)).toThrow();
  });

  it("every tier has colors", () => {
    for (const t of TIERS) {
      expect(t.topColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(t.accentColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe("pickDropTier (deterministic via injected rng)", () => {
  it("weights sum to 1 across droppable tiers", () => {
    expect(DROP_WEIGHTS).toHaveLength(5);
    const sum = DROP_WEIGHTS.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("rng=0 -> tier 1, rng~1 -> tier 5", () => {
    expect(pickDropTier(() => 0)).toBe(1);
    expect(pickDropTier(() => 0.999)).toBe(5);
  });

  it("maps mid-bucket values correctly", () => {
    // weights [.30,.28,.22,.14,.06] -> cum ~[.30,.58,.80,.94,1.0]
    // 경계값은 부동소수 오차로 모호하므로 각 버킷 내부 값으로 검증한다.
    expect(pickDropTier(() => 0.15)).toBe(1); // (0,.30)
    expect(pickDropTier(() => 0.45)).toBe(2); // (.30,.58)
    expect(pickDropTier(() => 0.7)).toBe(3); //  (.58,.80)
    expect(pickDropTier(() => 0.87)).toBe(4); // (.80,.94)
    expect(pickDropTier(() => 0.97)).toBe(5); // (.94,1.0)
  });
});
