import { describe, it, expect } from "vitest";
import { resolveMerge } from "@/domains/game/engine/merge";

describe("resolveMerge", () => {
  it("merges tier 3 into tier 4 and awards tier-4 creation score (6)", () => {
    expect(resolveMerge(3)).toEqual({ nextTier: 4, score: 6, isMaster: false });
  });

  it("merges tier 10 into tier 11 (master) and awards 55", () => {
    expect(resolveMerge(10)).toEqual({ nextTier: 11, score: 55, isMaster: false });
  });

  it("two master balls pop: no next tier, master bonus, isMaster true", () => {
    expect(resolveMerge(11)).toEqual({ nextTier: null, score: 100, isMaster: true });
  });

  it("awarded score always equals the created tier's config score (tiers 1..10)", () => {
    for (let t = 1; t <= 10; t++) {
      const r = resolveMerge(t);
      expect(r.nextTier).toBe(t + 1);
      expect(r.score).toBe(((t) * (t + 1)) / 2); // triangular score of tier t+1
    }
  });
});
