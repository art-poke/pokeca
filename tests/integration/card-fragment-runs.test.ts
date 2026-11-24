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

  it("ranks odd-card players by their best single run within the selected month", async () => {
    const player = randomUUID();
    const rival = randomUUID();
    await db.execute(sql`insert into users (id, name) values (${player}, 'Replay fixture'), (${rival}, 'Best score fixture')`);
    try {
      await db.execute(sql`
        insert into card_fragment_run_scores (id, user_id, game, day, wins, finished) values
          (${randomUUID()}, ${player}, 'odd', ${day}, 3, true),
          (${randomUUID()}, ${player}, 'odd', ${day}, 3, true),
          (${randomUUID()}, ${player}, 'odd', ${nextDay}, 2, true),
          (${randomUUID()}, ${player}, 'odd', '2026-10-31', 5, true),
          (${randomUUID()}, ${rival}, 'odd', ${day}, 4, true)
      `);
      const records = await loadRecords("odd", month, player);
      expect(records.bestRun).toBe(5);
      expect(records.bestMonth).toBe(5); // Personal best monthly result considers all recorded months.
      expect(records.ranking.find((row) => row.mine)).toMatchObject({ wins: 3 });
      const rivalRecords = await loadRecords("odd", month, rival);
      expect(rivalRecords.ranking.find((row) => row.mine)!.rank)
        .toBeLessThan(records.ranking.find((row) => row.mine)!.rank);
      expect((await loadRecords("odd", "2026-10", player)).ranking.find((row) => row.mine)).toMatchObject({ wins: 5 });
    } finally {
      await db.execute(sql`delete from users where id in (${player}, ${rival})`);
    }
  });

  it("includes multiple Pikachu versus Pichu combinations with distinct card art", async () => {
    const { rows } = await db.execute<{ count: number }>(sql`
      select count(distinct rotation_signature)::int as count
      from card_fragment_puzzles
      where game = 'odd' and similar_odd_pair and has_runtime_crop
        and cards->0->>'name' = '피카츄' and cards->1->>'name' = '피카츄'
        and cards->answer_slot->>'name' = '피츄'
        and cards->0->'cropSource'->>'id' <> cards->1->'cropSource'->>'id'
    `);
    expect(rows[0].count).toBeGreaterThanOrEqual(3);
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
    expect(cameos).toBe(0);
  }, 15_000);

  it("shrinks clues through a full run and introduces matching cameos only in later rounds", async () => {
    const player = randomUUID();
    await db.execute(sql`insert into users (id, name) values (${player}, 'Difficulty fixture')`);
    try {
      let puzzle = (await startRun("odd", day, player))!;
      let cameoRounds = 0;
      for (let round = 1; round <= 15; round++) {
        const { rows: [source] } = await db.execute<{
          answer_slot: number;
          similar_odd_pair: boolean;
          rotation_signature: string;
        }>(sql`
          select p.answer_slot, p.similar_odd_pair, p.rotation_signature
          from card_fragment_active_runs r join card_fragment_puzzles p
            on (p.day, p.game, p.stage) = (r.source_day, r.game, r.source_stage)
          where r.run_id = ${puzzle.runId}
        `);
        if (round <= 7) expect(source.similar_odd_pair).toBe(true);
        expect(puzzle.stage).toBe(round);
        const permutation = (Number.parseInt(puzzle.runId.slice(-6), 16) + round) % 6;
        const displaySlot = [[0, 1, 2], [2, 0, 1], [1, 2, 0], [0, 2, 1], [2, 1, 0], [1, 0, 2]][permutation][source.answer_slot];
        await continueRun("odd", player, puzzle.runId, round, 0, "start");
        const reveal = (await continueRun("odd", player, puzzle.runId, round, 0, { kind: "odd", value: displaySlot }))!.reveal!;
        const guest = reveal.cards[reveal.slot].cameo;
        if (reveal.cards.some((card) => card.cameo)) {
          expect(round).toBeGreaterThanOrEqual(8);
          expect(guest?.split(",").map((name) => name.trim().split(" ")[0])).toContain(reveal.cards[(reveal.slot + 1) % 3].name);
          cameoRounds++;
        }
        if ([1, 8, 15].includes(round)) {
          const original = await sharp((await runImage("odd", player, puzzle.runId, round, 0, "reveal"))!).metadata();
          const fragment = await sharp((await runImage("odd", player, puzzle.runId, round, 0, "close"))!).metadata();
          const placement = puzzle.fragments[0].placement!;
          expect(fragment.width).toBeCloseTo(original.width * (1 - placement.left - placement.right));
          expect(fragment.height).toBeCloseTo(original.height * (1 - placement.top - placement.bottom));
        }
        puzzle = (await continueRun("odd", player, puzzle.runId, round, 1, "next"))!;
      }
      expect(cameoRounds).toBeGreaterThanOrEqual(2);
    } finally {
      await db.execute(sql`delete from users where id = ${player}`);
    }
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
