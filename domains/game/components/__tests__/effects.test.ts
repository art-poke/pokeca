import { describe, it, expect } from "vitest";
import { EffectSystem } from "@/domains/game/components/effects";

const mergeEvent = (over = {}) => ({
  x: 180,
  y: 300,
  tier: 4,
  score: 6,
  isMaster: false,
  ...over,
});

describe("EffectSystem", () => {
  it("starts empty", () => {
    const fx = new EffectSystem();
    expect(fx.count()).toBe(0);
  });

  it("spawnMerge adds particles, a ring, and a floating score", () => {
    const fx = new EffectSystem();
    fx.spawnMerge(mergeEvent());
    expect(fx.count()).toBeGreaterThan(0);
  });

  it("master merge spawns more particles than a normal merge", () => {
    const normal = new EffectSystem();
    normal.spawnMerge(mergeEvent({ isMaster: false }));
    const master = new EffectSystem();
    master.spawnMerge(mergeEvent({ isMaster: true, tier: 11, score: 100 }));
    expect(master.count()).toBeGreaterThan(normal.count());
  });

  it("all effects expire after enough time", () => {
    const fx = new EffectSystem();
    fx.spawnMerge(mergeEvent());
    for (let i = 0; i < 300; i++) fx.update(16);
    expect(fx.count()).toBe(0);
  });
});
