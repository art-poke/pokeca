import { describe, it, expect, vi } from "vitest";
import { Game } from "@/domains/game/engine/game";
import { WORLD_WIDTH } from "@/domains/game/engine/ladder";

const stepFor = (g: Game, ms: number) => {
  const dt = 1000 / 60;
  for (let acc = 0; acc < ms; acc += dt) g.step(dt);
};

describe("Game — initial state", () => {
  it("starts empty with a held ball and a queue", () => {
    const g = new Game({ rng: () => 0.1 });
    const s = g.getSnapshot();
    expect(s.score).toBe(0);
    expect(s.isGameOver).toBe(false);
    expect(s.balls).toHaveLength(0);
    expect(s.nextTier).toBeGreaterThanOrEqual(1);
    expect(s.nextTier).toBeLessThanOrEqual(5);
    expect(s.queue).toHaveLength(3);
  });
});

describe("Game — drop & cooldown", () => {
  it("drop adds a ball and advances the held/queue; cooldown blocks instant re-drop", () => {
    const g = new Game({ rng: () => 0 }); // always tier 1
    const held = g.getSnapshot().nextTier;
    expect(g.drop(WORLD_WIDTH / 2)).toBe(true);
    expect(g.getSnapshot().balls).toHaveLength(1);
    // held advanced from queue
    expect(g.getSnapshot().queue).toHaveLength(3);
    expect(held).toBe(1);
    // immediate second drop blocked by cooldown
    expect(g.drop(WORLD_WIDTH / 2)).toBe(false);
    expect(g.getSnapshot().balls).toHaveLength(1);
  });
});

describe("Game — merge integration (real physics)", () => {
  it("two tier-1 balls dropped on the same column merge into one tier-2, award 1, fire onMerge once", () => {
    const onMerge = vi.fn();
    const g = new Game({ rng: () => 0, onMerge }); // tier 1 forever
    g.drop(WORLD_WIDTH / 2);
    stepFor(g, 800); // settle + pass cooldown
    expect(g.drop(WORLD_WIDTH / 2)).toBe(true);
    stepFor(g, 2500); // let it fall and merge
    const s = g.getSnapshot();
    expect(s.balls).toHaveLength(1);
    expect(s.balls[0].tier).toBe(2);
    expect(s.score).toBe(1);
    expect(onMerge).toHaveBeenCalledTimes(1);
  });
});

describe("Game — stats & grace", () => {
  it("getStats reports drops, maxTier, and positive duration", () => {
    const g = new Game({ rng: () => 0 });
    g.drop(WORLD_WIDTH / 2);
    stepFor(g, 800);
    g.drop(WORLD_WIDTH / 2);
    stepFor(g, 2500);
    const stats = g.getStats();
    expect(stats.ballsPlaced).toBe(2);
    expect(stats.maxTier).toBeGreaterThanOrEqual(2);
    expect(stats.durationMs).toBeGreaterThan(0);
  });

  it("does not game-over immediately after a drop (grace window)", () => {
    const g = new Game({ rng: () => 0 });
    g.drop(WORLD_WIDTH / 2);
    stepFor(g, 300); // within grace; ball also falls below the line
    expect(g.getSnapshot().isGameOver).toBe(false);
  });
});
