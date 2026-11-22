import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { NAME_OPENING_VARIANT, nameOpeningLevel, oddVariant } from "./crop";
import { applyRoundCommand, BANK_ROUNDS, initialTimedProgress, type Frame, type Game, type RoundCommand, type TimedProgress } from "./rules";
import { puzzleView, type Puzzle } from "./server";

type PracticeRound = Puzzle & TimedProgress & { run_id: string; round: number; recent_questions: string[]; source_variant: number; hints_used: number };
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function toView(game: Game, day: string, row: PracticeRound) {
  return puzzleView(game, day, row.round, row, row, { practiceId: row.run_id, practiceVariant: row.source_variant, hintsUsed: row.hints_used });
}

async function getRound(tx: Transaction, game: Game, day: string, userId: string) {
  return (await tx.execute<PracticeRound>(sql`
    select r.run_id, r.round, r.recent_questions, r.source_variant, r.hints_used, r.guesses, r.used_hint, r.solved, r.choice, extract(epoch from r.started_at)::float8 * 1000 as started_at, r.timed_out, p.cards, p.answer_slot, p.aliases, p.answer_kind
    from card_fragment_practice r
    join card_fragment_puzzles p on p.day = r.source_day and p.game = r.game and p.stage = r.source_stage
    where r.day = ${day} and r.game = ${game} and r.user_id = ${userId} and p.answer_kind = 'pokemon' for update of r
  `)).rows[0];
}

async function pickRound(tx: Transaction, game: Game, userId: string, runId: string, round: number, recent: string[]) {
  const result = await tx.execute<Puzzle & { day: string; stage: number; signature: string }>(sql`
    with bank as (
      select day, stage, cards, answer_slot, aliases, answer_kind, public.card_fragment_signature(cards) as signature
      from card_fragment_puzzles
      where game = ${game} and stage <= ${BANK_ROUNDS} and answer_kind = 'pokemon'
    ), ranked_recent as (
      select public.card_fragment_signature(p.cards) as signature
      from card_fragment_attempts a
      join card_fragment_puzzles p using (day, game, stage)
      where a.game = ${game} and a.user_id = ${userId}
      order by a.day desc, a.stage desc
      limit 24
    ), seen as (
      select signature, position::int as priority
      from jsonb_array_elements_text(${JSON.stringify(recent)}::jsonb) with ordinality as r(signature, position)
      union all
      select signature, 1 from ranked_recent
    )
    select day::text, stage, cards, answer_slot, aliases, answer_kind, signature from bank
    order by coalesce((select max(priority) from seen where seen.signature = bank.signature), 0),
      md5(concat(${runId}::text, '/', ${round}::int, '/', bank.signature)), day, stage
    limit 1
  `);
  const picked = result.rows[0];
  if (!picked) return null;
  const variants = await tx.execute<{ last: number }>(sql`
    select coalesce(max(variant), 0)::int as last from card_fragment_images
    where day = ${picked.day} and game = ${game} and stage = ${picked.stage} and frame = 'close' and (game <> 'name' or variant < ${NAME_OPENING_VARIANT})
  `);
  const variant = game === "odd" ? Math.min(oddVariant(round), variants.rows[0].last) : randomInt(variants.rows[0].last + 1);
  return { ...picked, run_id: runId, round, source_variant: variant, recent_questions: [...recent.filter((key) => key !== picked.signature), picked.signature].slice(-24), hints_used: 0, ...initialTimedProgress };
}

export async function startPractice(game: Game, day: string, userId: string) {
  return db.transaction(async (tx) => {
    const finished = await tx.execute(sql`
      select 1 from card_fragment_attempts where day = ${day} and game = ${game} and user_id = ${userId} and solved = false
    `);
    if (!finished.rows.length) return null;

    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(concat('card-fragment-practice/', ${userId}::text, '/', ${game}::text), 0))`);
    const history = await tx.execute<{ recent_questions: string[] }>(sql`
      select recent_questions from card_fragment_practice where game = ${game} and user_id = ${userId} for update
    `);
    const next = await pickRound(tx, game, userId, randomUUID(), 1, history.rows[0]?.recent_questions ?? []);
    if (!next) return null;
    await tx.execute(sql`
      insert into card_fragment_practice (user_id, game, run_id, day, round, source_day, source_stage, source_variant, recent_questions)
      values (${userId}, ${game}, ${next.run_id}, ${day}, 1, ${next.day}, ${next.stage}, ${next.source_variant}, array(select jsonb_array_elements_text(${JSON.stringify(next.recent_questions)}::jsonb)))
      on conflict (user_id, game) do update
      set run_id = excluded.run_id, day = excluded.day, round = 1, source_day = excluded.source_day,
          source_stage = excluded.source_stage, source_variant = excluded.source_variant, recent_questions = excluded.recent_questions, hints_used = 0, guesses = 0, used_hint = false, solved = null, choice = null, started_at = null, timed_out = false
    `);
    return toView(game, day, next);
  });
}

export async function continuePractice(game: Game, day: string, userId: string, runId: string, round: number, guess: RoundCommand | "next") {
  return db.transaction(async (tx) => {
    const current = await getRound(tx, game, day, userId);
    if (!current || current.run_id !== runId) return null;
    if (current.round !== round) return toView(game, day, current);

    if (guess === "next") {
      if (current.solved !== true) return null;
      const next = await pickRound(tx, game, userId, runId, round + 1, current.recent_questions);
      if (!next) return null;
      await tx.execute(sql`
        update card_fragment_practice
        set round = ${next.round}, source_day = ${next.day}, source_stage = ${next.stage}, source_variant = ${next.source_variant},
            recent_questions = array(select jsonb_array_elements_text(${JSON.stringify(next.recent_questions)}::jsonb)),
            guesses = 0, used_hint = false, solved = null, choice = null, started_at = null, timed_out = false
        where game = ${game} and user_id = ${userId}
      `);
      return toView(game, day, { ...next, hints_used: current.hints_used });
    }

    const progress = applyRoundCommand(current, guess, {
      name: current.cards[current.answer_slot].name, aliases: current.aliases, slot: current.answer_slot,
    }, new Date(), current.hints_used);
    const hintsUsed = current.hints_used + Number(progress.used_hint && !current.used_hint);
    await tx.execute(sql`
      update card_fragment_practice
      set guesses = ${progress.guesses}, used_hint = ${progress.used_hint}, hints_used = ${hintsUsed}, solved = ${progress.solved}, choice = ${progress.choice},
          started_at = ${progress.started_at === null ? null : new Date(progress.started_at).toISOString()}, timed_out = ${progress.timed_out}
      where game = ${game} and user_id = ${userId}
    `);
    return toView(game, day, { ...current, ...progress, hints_used: hintsUsed });
  });
}

export async function practiceImage(game: Game, day: string, userId: string, runId: string, round: number, slot: number, frame: Frame) {
  const opening = nameOpeningLevel(round);
  const openingVariant = opening === null ? -1 : NAME_OPENING_VARIANT + opening;
  const result = await db.execute<{ image: Buffer }>(sql`
    select i.image from card_fragment_practice r
    join card_fragment_puzzles p on (p.day, p.game, p.stage) = (r.source_day, r.game, r.source_stage) and p.answer_kind = 'pokemon'
    join card_fragment_images i on i.game = r.game and i.day = r.source_day and i.stage = r.source_stage
    where r.game = ${game} and r.day = ${day} and r.user_id = ${userId} and r.run_id = ${runId} and r.round = ${round}
      and i.slot = ${slot} and i.frame = ${frame}
      and (case when i.frame = 'reveal' then i.variant = 0
        when i.game = 'odd' then i.variant in (0, ${oddVariant(round)})
        else i.variant in (0, r.source_variant, ${openingVariant}) end)
      and ((i.frame = 'close' and r.started_at is not null) or (i.frame = 'wide' and r.used_hint) or (i.frame = 'reveal' and r.solved is not null))
    order by i.variant desc limit 1
  `);
  return result.rows[0]?.image;
}
