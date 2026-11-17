import { describe, it, expect } from "vitest";
import { DeadlineWatcher } from "@/domains/game/engine/deadline";

// deadlineY=100, grace=600ms, gameOver=1000ms
const mk = () => new DeadlineWatcher(100, 600, 1000);

describe("DeadlineWatcher", () => {
  it("never triggers for a ball below the deadline line", () => {
    const w = mk();
    let over = false;
    for (let i = 0; i < 200; i++) over = w.update(16, [{ id: 1, topY: 300, ageMs: 5000 }]);
    expect(over).toBe(false);
  });

  it("does not trigger while a high ball is still within the grace window", () => {
    const w = mk();
    let over = false;
    // ageMs below grace(600) the whole time, even though above the line
    for (let i = 0; i < 30; i++) over = w.update(16, [{ id: 1, topY: 50, ageMs: 100 }]);
    expect(over).toBe(false);
  });

  it("triggers once a settled high ball stays above the line past gameOverMs", () => {
    const w = mk();
    let over = false;
    // aged past grace, above the line → accumulate; needs ~1000ms
    for (let i = 0; i < 70; i++) over = over || w.update(16, [{ id: 1, topY: 50, ageMs: 2000 }]);
    expect(over).toBe(true);
  });

  it("resets the accumulator when the ball drops back below the line", () => {
    const w = mk();
    // accumulate ~900ms above (not yet over)
    for (let i = 0; i < 56; i++) w.update(16, [{ id: 1, topY: 50, ageMs: 2000 }]);
    // drop below → reset
    w.update(16, [{ id: 1, topY: 300, ageMs: 2000 }]);
    // back above: should need a full fresh 1000ms, so 10 steps (~160ms) must not trigger
    let over = false;
    for (let i = 0; i < 10; i++) over = over || w.update(16, [{ id: 1, topY: 50, ageMs: 2000 }]);
    expect(over).toBe(false);
  });

  it("forgets balls that disappear (merged/removed)", () => {
    const w = mk();
    w.update(16, [{ id: 1, topY: 50, ageMs: 2000 }]);
    // ball 1 gone, ball 2 fresh below line
    const over = w.update(16, [{ id: 2, topY: 300, ageMs: 2000 }]);
    expect(over).toBe(false);
    expect(w.size()).toBe(1);
  });

  it("reports danger time while above the line (for countdown)", () => {
    const w = mk();
    for (let i = 0; i < 10; i++) w.update(16, [{ id: 1, topY: 50, ageMs: 2000 }]);
    expect(w.dangerMs()).toBeCloseTo(160, 0);
    // drops below → danger resets to 0
    w.update(16, [{ id: 1, topY: 300, ageMs: 2000 }]);
    expect(w.dangerMs()).toBe(0);
  });
});

describe("DeadlineWatcher — ceiling (instant) + 10s warning", () => {
  // deadlineY=100, grace=600, gameOver=10000(10s), ceilingY=30
  const mk2 = () => new DeadlineWatcher(100, 600, 10_000, 30);

  it("instantly triggers when a settled ball touches the ceiling", () => {
    const w = mk2();
    expect(w.update(16, [{ id: 1, topY: 20, ageMs: 2000 }])).toBe(true);
  });

  it("ceiling respects the grace window (fresh ball does not instant-kill)", () => {
    const w = mk2();
    expect(w.update(16, [{ id: 1, topY: 20, ageMs: 100 }])).toBe(false);
  });

  it("a ball only in the warning band gets the full 10s before game over", () => {
    const w = mk2();
    let over = false;
    // 9초: 아직 안 끝남
    for (let i = 0; i < Math.floor(9000 / 16); i++) over = over || w.update(16, [{ id: 1, topY: 50, ageMs: 2000 }]);
    expect(over).toBe(false);
    // 10초 넘기면 끝
    for (let i = 0; i < Math.floor(1500 / 16); i++) over = over || w.update(16, [{ id: 1, topY: 50, ageMs: 2000 }]);
    expect(over).toBe(true);
  });
});
