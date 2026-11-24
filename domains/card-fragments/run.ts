import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/lib/db";
import { NAME_OPENING_VARIANT, nameOpeningLevel, oddVariant, runtimeCrop } from "./crop";
import { applyRoundCommand, BANK_ROUNDS, initialTimedProgress, type Frame, type Game, type RoundCommand, type TimedProgress } from "./rules";
import { puzzleView, type Puzzle } from "./round-view";

type ActiveRound = Puzzle & TimedProgress & { run_id: string; day: string; round: number; recent_questions: string[]; source_variant: number; hints_used: number };
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function slotOrder(game: Game, runId: string, round: number) {
  if (game === "name") return [0];
  const offset = (Number.parseInt(runId.slice(-6), 16) + round) % 6;
  return [[0, 1, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [2, 1, 0], [1, 0, 2]][offset];
}

function toView(game: Game, row: ActiveRound) {
  const order = slotOrder(game, row.run_id, row.round);
  const puzzle = { ...row, cards: order.map((slot) => row.cards[slot]), answer_slot: order.indexOf(row.answer_slot) };
  return puzzleView(game, row.day, row.round, puzzle, row, row.run_id, row.source_variant, row.hints_used);
}

async function getRound(tx: Transaction, game: Game, userId: string) {
  return (await tx.execute<ActiveRound>(sql`
    select r.run_id, r.day::text, r.round, r.recent_questions, r.source_variant, r.hints_used, r.guesses, r.used_hint, r.solved, r.choice,
      extract(epoch from r.started_at)::float8 * 1000 as started_at, r.timed_out, p.cards, p.answer_slot, p.aliases
    from card_fragment_active_runs r
    join card_fragment_puzzles p on (p.day, p.game, p.stage) = (r.source_day, r.game, r.source_stage)
    where r.game = ${game} and r.user_id = ${userId} and p.answer_kind = 'pokemon' for update of r
  `)).rows[0];
}

async function pickRound(tx: Transaction, game: Game, day: string, runId: string, round: number, recent: string[]) {
  // Keep the introduction readable. Later cameo rounds use the run ID to vary the cadence.
  const favorCameo = game === "odd" && round >= 8 && (Number.parseInt(runId.slice(0, 8), 16) + round) % 3 === 0;
  const result = await tx.execute<Puzzle & { source_day: string; source_stage: number; signature: string }>(sql`
    with recent as (
      select signature, position::int
      from jsonb_array_elements_text(${JSON.stringify(recent)}::jsonb) with ordinality as r(signature, position)
    ), recent_cards as (
      select card, max(position) as position
      from recent cross join lateral unnest(string_to_array(signature, '/')) as card
      where position > greatest(0, ${recent.length} - 8)
      group by card
    ), picked as (
      select p.day, p.game, p.stage, p.rotation_signature
      from card_fragment_puzzles p left join recent on recent.signature = p.rotation_signature
      where p.game = ${game} and p.stage <= ${BANK_ROUNDS} and p.answer_kind = 'pokemon'
      order by coalesce(recent.position, 0),
        (p.has_cameo = ${favorCameo}) desc,
        p.has_runtime_crop desc,
        case when ${favorCameo} then exists (
          select 1 from regexp_split_to_table(p.cards->p.answer_slot->>'cameo', ',') as guest(name)
          where split_part(btrim(guest.name), ' ', 1) = p.cards->((p.answer_slot + 1) % 3)->>'name'
        ) else p.similar_odd_pair end desc,
        coalesce((select sum(position - greatest(0, ${recent.length} - 8)) from recent_cards
          where card = any(string_to_array(p.rotation_signature, '/'))), 0),
        md5(concat(${runId}::text, '/', ${round}::int, '/', p.rotation_signature)), p.day, p.stage
      limit 1
    )
    select p.day::text as source_day, p.stage as source_stage, p.cards, p.answer_slot, p.aliases, picked.rotation_signature as signature
    from picked join card_fragment_puzzles p using (day, game, stage)
  `);
  const picked = result.rows[0];
  if (!picked) return null;
  let variant = 0;
  if (!picked.cards[0].cropSource) {
    const variants = await tx.execute<{ last: number }>(sql`
      select coalesce(max(variant), 0)::int as last from card_fragment_images
      where day = ${picked.source_day} and game = ${game} and stage = ${picked.source_stage}
        and frame = 'close' and (game <> 'name' or variant < ${NAME_OPENING_VARIANT})
    `);
    variant = game === "odd" ? Math.min(oddVariant(round), variants.rows[0].last) : randomInt(variants.rows[0].last + 1);
  }
  return { ...picked, day, run_id: runId, round, source_variant: variant,
    recent_questions: [...recent.filter((key) => key !== picked.signature), picked.signature].slice(-32), hints_used: 0, ...initialTimedProgress };
}

export async function startRun(game: Game, day: string, userId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(concat('card-fragment-run/', ${userId}::text, '/', ${game}::text), 0))`);
    const current = await getRound(tx, game, userId);
    // Retrying a start before its countdown finishes returns the same question.
    if (current?.day === day && current.round === 1 && current.started_at === null && current.solved === null) return toView(game, current);
    const next = await pickRound(tx, game, day, randomUUID(), 1, current?.recent_questions ?? []);
    if (!next) return null;
    if (current) await tx.execute(sql`update card_fragment_run_scores set finished = true where id = ${current.run_id}`);
    await tx.execute(sql`
      insert into card_fragment_active_runs (user_id, game, run_id, day, round, source_day, source_stage, source_variant, recent_questions)
      values (${userId}, ${game}, ${next.run_id}, ${day}, 1, ${next.source_day}, ${next.source_stage}, ${next.source_variant},
        array(select jsonb_array_elements_text(${JSON.stringify(next.recent_questions)}::jsonb)))
      on conflict (user_id, game) do update
      set run_id = excluded.run_id, day = excluded.day, round = 1, source_day = excluded.source_day,
          source_stage = excluded.source_stage, source_variant = excluded.source_variant, recent_questions = excluded.recent_questions,
          hints_used = 0, guesses = 0, used_hint = false, solved = null, choice = null, started_at = null, timed_out = false
    `);
    return toView(game, next);
  });
}

export async function continueRun(game: Game, userId: string, runId: string, round: number, expected: number, command: RoundCommand | "next") {
  return db.transaction(async (tx) => {
    const current = await getRound(tx, game, userId);
    if (!current || current.run_id !== runId) return null;
    if (current.round !== round || current.guesses !== expected) return toView(game, current);

    if (command === "next") {
      if (current.solved !== true) return null;
      const next = await pickRound(tx, game, current.day, runId, round + 1, current.recent_questions);
      if (!next) return null;
      await tx.execute(sql`
        update card_fragment_active_runs
        set round = ${next.round}, source_day = ${next.source_day}, source_stage = ${next.source_stage}, source_variant = ${next.source_variant},
            recent_questions = array(select jsonb_array_elements_text(${JSON.stringify(next.recent_questions)}::jsonb)),
            guesses = 0, used_hint = false, solved = null, choice = null, started_at = null, timed_out = false
        where game = ${game} and user_id = ${userId}
      `);
      return toView(game, { ...next, hints_used: current.hints_used });
    }

    if (current.solved !== null) return toView(game, current);
    const progress = applyRoundCommand(current, command, {
      name: current.cards[current.answer_slot].name, aliases: current.aliases, slot: slotOrder(game, runId, round).indexOf(current.answer_slot),
    }, new Date(), current.hints_used);
    const hintsUsed = current.hints_used + Number(progress.used_hint && !current.used_hint);
    await tx.execute(sql`
      update card_fragment_active_runs
      set guesses = ${progress.guesses}, used_hint = ${progress.used_hint}, hints_used = ${hintsUsed}, solved = ${progress.solved}, choice = ${progress.choice},
          started_at = ${progress.started_at === null ? null : new Date(progress.started_at).toISOString()}, timed_out = ${progress.timed_out}
      where game = ${game} and user_id = ${userId}
    `);
    if (round === 1 && current.started_at === null && progress.started_at !== null) {
      await tx.execute(sql`
        insert into card_fragment_run_scores (id, user_id, game, day)
        values (${runId}, ${userId}, ${game}, ${current.day}) on conflict (id) do nothing
      `);
    }
    if (progress.solved !== null) {
      const wins = Number(progress.solved);
      const stars = Number(progress.solved && progress.guesses === 1 && !progress.used_hint);
      await tx.execute(sql`
        insert into card_fragment_run_scores (id, user_id, game, day, wins, stars, finished)
        values (${runId}, ${userId}, ${game}, ${current.day}, ${wins}, ${stars}, ${!progress.solved})
        on conflict (id) do update set wins = card_fragment_run_scores.wins + excluded.wins,
          stars = card_fragment_run_scores.stars + excluded.stars, finished = excluded.finished
      `);
    }
    return toView(game, { ...current, ...progress, hints_used: hintsUsed });
  });
}

export async function runImage(game: Game, userId: string, runId: string, round: number, slot: number, frame: Frame) {
  const sourceSlot = slotOrder(game, runId, round)[slot];
  if (sourceSlot === undefined || (game === "odd" && frame === "wide")) return;
  const opening = nameOpeningLevel(round);
  const openingVariant = opening === null ? -1 : NAME_OPENING_VARIANT + opening;
  const result = await db.execute<{ card: Puzzle["cards"][number]; image: Buffer | null }>(sql`
    select p.cards->(${sourceSlot}::int) as card, coalesce(source.image, legacy.image) as image
    from card_fragment_active_runs r
    join card_fragment_puzzles p on (p.day, p.game, p.stage) = (r.source_day, r.game, r.source_stage)
    left join card_fragment_source_images source on source.id = p.cards->(${sourceSlot}::int)->'cropSource'->>'id'
    left join lateral (
      select i.image from card_fragment_images i
      where source.id is null and (i.day, i.game, i.stage) = (r.source_day, r.game, r.source_stage)
        and i.slot = ${sourceSlot} and i.frame = ${frame}
        and (case when i.frame = 'reveal' then i.variant = 0
          when i.game = 'odd' then i.variant in (0, r.source_variant)
          else i.variant in (0, r.source_variant, ${openingVariant}) end)
      order by i.variant desc limit 1
    ) legacy on true
    where r.game = ${game} and r.user_id = ${userId} and r.run_id = ${runId} and r.round = ${round}
      and p.answer_kind = 'pokemon'
      and ((${frame} = 'close' and r.started_at is not null) or (${frame} = 'wide' and r.used_hint)
        or (${frame} = 'reveal' and r.solved is not null))
  `);
  const row = result.rows[0];
  if (!row?.image) return;
  if (frame === "reveal" || !row.card.cropSource) return row.image;
  const { crop } = runtimeCrop(row.card.cropSource, game, round, runId, slot, frame);
  return sharp(row.image).extract(crop).webp({ quality: 88 }).toBuffer();
}
