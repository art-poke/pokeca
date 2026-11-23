import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { continueRun, runImage, startRun } from "@/domains/card-fragments/run";
import { loadRecords } from "@/domains/card-fragments/server";
import type { PuzzleView } from "@/domains/card-fragments/round-view";

const userId = randomUUID();
const day = "2026-11-22";
const month = day.slice(0, 7);
const nextDay = "2026-11-23";

describe("card fragment runs", () => {
  beforeAll(async () => {
    await db.execute(sql`insert into users (id, name) values (${userId}, 'Card fragment fixture')`);
  });

  afterAll(async () => {
    await db.execute(sql`delete from users where id = ${userId}`);
  });

  async function expectedAnswer(puzzle: PuzzleView) {
    const { rows } = await db.execute<{ name: string; answer_slot: number }>(sql`
      select p.cards->p.answer_slot->>'name' as name, p.answer_slot
      from card_fragment_active_runs r join card_fragment_puzzles p
        on (p.day, p.game, p.stage) = (r.source_day, r.game, r.source_stage)
      where r.run_id = ${puzzle.runId}
    `);
    return rows[0];
  }

  it("counts both same-day runs, preserves the best individual streak, and resets the hint allowance", async () => {
    let firstRunId = "";
    for (const length of [2, 1]) {
      let puzzle = (await startRun("name", day, userId))!;
      expect(puzzle.runId).not.toBe(firstRunId);
      firstRunId = puzzle.runId;
      for (let round = 1; round <= length; round++) {
        expect(puzzle.hintsRemaining).toBe(3 - round);
        expect(puzzle.stage).toBe(round);
        expect(await runImage("name", userId, puzzle.runId, round, 0, "close")).toBeUndefined();
        puzzle = (await continueRun("name", userId, puzzle.runId, round, 0, "start"))!;
        expect(await runImage("name", userId, puzzle.runId, round, 0, "reveal")).toBeUndefined();
        expect(await runImage("name", randomUUID(), puzzle.runId, round, 0, "close")).toBeUndefined();
        const fragment = (await runImage("name", userId, puzzle.runId, round, 0, "close"))!;
        const placement = puzzle.fragments[0].placement!;
        const { width, height } = await sharp(fragment).metadata();
        const answer = await expectedAnswer(puzzle);
        const hint = await continueRun("name", userId, puzzle.runId, round, 0, { kind: "hint" });
        expect(hint?.hintsRemaining).toBe(2 - round);
        const correct = { kind: "name", value: answer.name.split("").join(" ") } as const;
        const result = await Promise.all([
          continueRun("name", userId, puzzle.runId, round, 0, correct),
          continueRun("name", userId, puzzle.runId, round, 0, correct),
        ]);
        expect(result.every((view) => view?.progress.solved)).toBe(true);
        const original = (await runImage("name", userId, puzzle.runId, round, 0, "reveal"))!;
        const full = await sharp(original).metadata();
        expect(width).toBeCloseTo((1 - placement.left - placement.right) * full.width);
        expect(height).toBeCloseTo((1 - placement.top - placement.bottom) * full.height);
        puzzle = (await continueRun("name", userId, puzzle.runId, round, 1, "next"))!;
      }
      await continueRun("name", userId, puzzle.runId, puzzle.stage, 0, "start");
      const miss = await continueRun("name", userId, puzzle.runId, puzzle.stage, 0, { kind: "name", value: "not a pokemon" });
      expect(miss?.progress.solved).toBe(false);
    }
    const records = await loadRecords("name", month, userId);
    expect(records.bestRun).toBe(2);
    expect(records.ranking.find((row) => row.mine)).toMatchObject({ wins: 3, stars: 0 });
    const { rows } = await db.execute<{ count: number }>(sql`
      select count(*)::int as count from card_fragment_run_scores where user_id = ${userId} and game = 'name' and day = ${day} and finished
    `);
    expect(rows[0].count).toBe(2);
  });

  it("rotates odd-card combinations across restarts and reveals the matching card at the scored slot", async () => {
    const shown = new Set<string>();
    const shownSpecies = new Set<string>();
    let cameos = 0;
    for (let index = 0; index < 10; index++) {
      const puzzle = (await startRun("odd", nextDay, userId))!;
      await continueRun("odd", userId, puzzle.runId, 1, 0, "start");
      const result = (await continueRun("odd", userId, puzzle.runId, 1, 0, { kind: "odd", value: 0 }))!;
      expect(result.progress.solved).toBe(result.reveal?.slot === 0);
      const cards = result.reveal!.cards;
      const odd = cards[result.reveal!.slot];
      expect(odd.name).toBe((await expectedAnswer(puzzle)).name);
      expect(cards.filter((card) => card.name === odd.name)).toHaveLength(1);
      for (const card of cards) shownSpecies.add(card.name);
      if (cards.some((card) => card.cameo)) cameos++;
      shown.add(cards.map((card) => card.href).sort().join("|"));
    }
    expect(shown.size).toBe(10);
    expect(shownSpecies.size).toBeGreaterThan(10);
    expect(cameos).toBeGreaterThan(0);
  }, 15_000);

  it("expires the round and retains a zero-score result", async () => {
    const puzzle = (await startRun("odd", nextDay, userId))!;
    await continueRun("odd", userId, puzzle.runId, 1, 0, "start");
    await db.execute(sql`update card_fragment_active_runs set started_at = now() - interval '21 seconds' where run_id = ${puzzle.runId}`);
    const expired = await continueRun("odd", userId, puzzle.runId, 1, 0, "timeout");
    expect(expired).toMatchObject({ timedOut: true, progress: { solved: false } });
    const { rows } = await db.execute(sql`select wins, finished from card_fragment_run_scores where id = ${puzzle.runId}`);
    expect(rows).toEqual([{ wins: 0, finished: true }]);
  });
});
