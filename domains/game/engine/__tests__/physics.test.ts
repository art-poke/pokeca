import { describe, it, expect } from "vitest";
import Matter from "matter-js";
import { createPhysics } from "@/domains/game/engine/physics";
import { tierConfig, GRAVITY_Y } from "@/domains/game/engine/ladder";

describe("createPhysics", () => {
  it("sets downward gravity", () => {
    const p = createPhysics();
    expect(p.engine.gravity.y).toBe(GRAVITY_Y);
  });

  it("builds exactly 3 static walls (left, right, floor)", () => {
    const p = createPhysics();
    const statics = Matter.Composite.allBodies(p.engine.world).filter((b) => b.isStatic);
    expect(statics).toHaveLength(3);
  });

  it("addBall creates a circle with correct radius, tier, and id", () => {
    const p = createPhysics();
    const b = p.addBall(3, 180, 50);
    expect(b.circleRadius).toBeCloseTo(tierConfig(3).radius, 5);
    expect(b.plugin.tier).toBe(3);
    expect(typeof b.plugin.ballId).toBe("number");
    expect(p.getBalls()).toContain(b);
  });

  it("gives each ball a unique id", () => {
    const p = createPhysics();
    const a = p.addBall(1, 100, 50);
    const b = p.addBall(1, 200, 50);
    expect(a.plugin.ballId).not.toBe(b.plugin.ballId);
  });

  it("gravity makes a ball fall when stepped", () => {
    const p = createPhysics();
    const b = p.addBall(1, 180, 60);
    const y0 = b.position.y;
    for (let i = 0; i < 30; i++) p.step(1000 / 60);
    expect(b.position.y).toBeGreaterThan(y0);
  });

  it("removeBall takes the ball out of the world", () => {
    const p = createPhysics();
    const b = p.addBall(1, 180, 50);
    p.removeBall(b);
    expect(p.getBalls()).not.toContain(b);
  });
});
