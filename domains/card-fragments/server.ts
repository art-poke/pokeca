import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cardPath } from "@/lib/search";
import { NAME_OPENING_VARIANT, nameOpeningLevel, oddVariant, type CardPlacement, type NamePlacements } from "./crop";
import { applyRoundCommand, BANK_ROUNDS, currentFrame, initialTimedProgress, longestStreak, ROUND_LIMIT_MS, RUN_HINT_LIMIT, type AnswerKind, type Frame, type Game, type RoundCommand, type TimedProgress } from "./rules";

type Card = { name: string; set: string; number: string; source: string; detailUrl?: string; cameo?: string; shiny?: boolean; placement?: CardPlacement; placements?: CardPlacement[]; namePlacements?: NamePlacements; openingPlacements?: NamePlacements };
export type Puzzle = { cards: Card[]; answer_slot: number; aliases: string[]; answer_kind: AnswerKind };

async function getPuzzle(game: Game, day: string, stage: number) {
  const result = await db.execute<Puzzle>(sql`
    select p.cards, p.answer_slot, p.aliases, p.answer_kind
    from card_fragment_puzzles p where p.day = ${day} and p.game = ${game} and p.stage = ${stage} and not p.bank_only and p.answer_kind = 'pokemon'
  `);
  return result.rows[0];
}

async function stageIsUnlocked(game: Game, day: string, stage: number, userId: string) {
  if (stage === 1) return true;
  const result = await db.execute(sql`
    select 1 from card_fragment_attempts
    where game = ${game} and day = ${day} and stage = ${stage - 1} and user_id = ${userId} and solved
  `);
  return result.rows.length > 0;
}

export async function findCurrentRound(game: Game, day: string, userId: string) {
  const result = await db.execute<{ round: number }>(sql`
    select (coalesce(max(stage) filter (where solved), 0) + 1)::int as round
    from card_fragment_attempts where game = ${game} and day = ${day} and user_id = ${userId}
  `);
  return result.rows[0].round;
}

async function prepareRound(game: Game, day: string, stage: number) {
  // 같은 날짜의 기존 문제를 피하고, 문제 은행을 다 돌면 적게 나온 문제부터 재사용한다.
  await db.execute(sql`
    with bank as (
      select day, stage, cards, answer_slot, aliases, answer_kind, public.card_fragment_signature(cards) as signature
      from card_fragment_puzzles
      where game = ${game} and stage <= ${BANK_ROUNDS} and answer_kind = 'pokemon' and day <> ${day}::date
    ), used as (
      select public.card_fragment_signature(cards) as signature, count(*) as appearances
      from card_fragment_puzzles
      where day = ${day} and game = ${game} and not bank_only
      group by 1
    ), pick as (
      select bank.* from bank left join used using (signature)
      order by coalesce(used.appearances, 0), md5(concat(${day}::date, '/', bank.signature)), bank.day, bank.stage
      limit 1
    ), inserted as (
      insert into card_fragment_puzzles (day, game, stage, cards, answer_slot, aliases, answer_kind)
      select ${day}, ${game}, ${stage}, cards, answer_slot, aliases, answer_kind from pick
      on conflict (day, game, stage) do nothing
      returning day
    )
    insert into card_fragment_images (day, game, stage, slot, frame, variant, image)
    select inserted.day, i.game, ${stage}, i.slot, i.frame, i.variant, i.image
    from inserted cross join pick
    join card_fragment_images i on i.day = pick.day and i.stage = pick.stage and i.game = ${game}
  `);
}

export function puzzleView(game: Game, day: string, stage: number, puzzle: Puzzle, progress: TimedProgress,
  options: { hintsUsed: number; practiceId?: string; practiceVariant?: number },
) {
  const { hintsUsed, practiceId, practiceVariant } = options;
  const image = (slot: number, frame: Frame) =>
    `/api/card-fragments/${game}/${slot}/${frame}?day=${day}&stage=${stage}${practiceId ? "&practice=" + practiceId : ""}`;
  const images = (frame: Frame) => puzzle.cards.map((_, slot) => image(slot, frame));
  const nameFrame = progress.used_hint ? "wide" : "close";
  const fragments = puzzle.cards.map((card, slot) => {
    if (game === "odd") return { image: image(slot, "close"), placement: card.placements?.[oddVariant(stage)] ?? card.placement };
    const level = nameOpeningLevel(stage);
    const opening = level === null ? undefined : card.openingPlacements?.[nameFrame][level];
    if (opening) return { image: image(slot, nameFrame), placement: opening };
    const positions = card.namePlacements?.[nameFrame];
    // Match the ranked image query's date-specific ordering and keep the same variant for hints.
    const variant = practiceVariant ?? positions?.map((_, index) => ({
      index, hash: createHash("md5").update(`${day}/${stage}/${slot}/${index}`).digest("hex"),
    })).sort((a, b) => a.hash.localeCompare(b.hash) || a.index - b.index)[0]?.index ?? 0;
    return { image: image(slot, nameFrame), placement: positions?.[variant] ?? positions?.[0] };
  });
  return {
    day,
    stage,
    practiceId,
    answerKind: puzzle.answer_kind,
    hintsRemaining: Math.max(0, RUN_HINT_LIMIT - hintsUsed),
    images: images(currentFrame(progress)),
    fragments,
    progress: { guesses: progress.guesses, used_hint: progress.used_hint, solved: progress.solved, choice: progress.choice },
    deadline: progress.started_at !== null ? progress.started_at + ROUND_LIMIT_MS : null,
    timedOut: progress.timed_out,
    reveal: progress.solved === null ? null : {
      slot: puzzle.answer_slot,
      cards: puzzle.cards.map((card, slot) => ({
        name: card.name,
        cameo: card.cameo,
        shiny: card.shiny,
        href: card.detailUrl ?? cardPath(card.set, card.number),
        image: image(slot, "reveal"),
      })),
    },
  };
}

export type PuzzleView = ReturnType<typeof puzzleView>;

function rankedHintCount(day: string, userId: string) {
  return sql`(select count(*)::int from card_fragment_attempts
    where game = 'name' and day = ${day} and user_id = ${userId} and used_hint)`;
}

export async function loadPuzzle(game: Game, day: string, stage: number, userId: string, options?: { closeExpired: boolean }) {
  if (!await stageIsUnlocked(game, day, stage, userId)) return null;
  let puzzle = await getPuzzle(game, day, stage);
  if (!puzzle && stage > 1) {
    await prepareRound(game, day, stage);
    puzzle = await getPuzzle(game, day, stage);
  }
  if (!puzzle) return null;
  const result = await db.execute<{ progress: TimedProgress | null; hints_used: number }>(sql`
    select (select jsonb_build_object('guesses', guesses, 'used_hint', used_hint, 'solved', solved,
      'choice', choice, 'started_at', extract(epoch from started_at)::float8 * 1000, 'timed_out', timed_out)
      from card_fragment_attempts where game = ${game} and day = ${day} and stage = ${stage} and user_id = ${userId}) as progress,
      ${game === "name" ? rankedHintCount(day, userId) : sql`0`} as hints_used
  `);
  const { progress: stored, hints_used: hintsUsed } = result.rows[0];
  const progress = stored ?? initialTimedProgress;
  if (options?.closeExpired && progress.solved === null && progress.started_at !== null
      && Date.now() - progress.started_at >= ROUND_LIMIT_MS) {
    return submitGuess(game, day, stage, userId, progress.guesses, "timeout");
  }
  return puzzleView(game, day, stage, puzzle, progress, { hintsUsed });
}

export async function submitGuess(game: Game, day: string, stage: number, userId: string, expected: number, command: RoundCommand) {
  if (!await stageIsUnlocked(game, day, stage, userId)) return null;
  const puzzle = await getPuzzle(game, day, stage);
  if (!puzzle) return null;
  return db.transaction(async (tx) => {
    if (game === "name" && typeof command === "object" && command.kind === "hint") {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(concat('card-fragment-hints/', ${userId}::text, '/', ${day}::text), 0))`);
    }
    await tx.execute(sql`
      insert into card_fragment_attempts (game, day, stage, user_id)
      values (${game}, ${day}, ${stage}, ${userId}) on conflict do nothing
    `);
    const result = await tx.execute<TimedProgress & { hints_used: number }>(sql`
      select guesses, used_hint, solved, choice, extract(epoch from started_at)::float8 * 1000 as started_at, timed_out,
        ${game === "name" ? rankedHintCount(day, userId) : sql`0`} as hints_used from card_fragment_attempts
      where game = ${game} and day = ${day} and stage = ${stage} and user_id = ${userId} for update
    `);
    const previous = result.rows[0];
    const hintsUsed = previous.hints_used;
    if (previous.guesses !== expected || previous.solved !== null) return puzzleView(game, day, stage, puzzle, previous, { hintsUsed });

    const next = applyRoundCommand(previous, command, {
      name: puzzle.cards[puzzle.answer_slot].name, aliases: puzzle.aliases, slot: puzzle.answer_slot,
    }, new Date(), hintsUsed);
    await tx.execute(sql`
      update card_fragment_attempts
      set guesses = ${next.guesses}, used_hint = ${next.used_hint}, solved = ${next.solved}, choice = ${next.choice},
          started_at = ${next.started_at === null ? null : new Date(next.started_at).toISOString()}, timed_out = ${next.timed_out}
      where game = ${game} and day = ${day} and stage = ${stage} and user_id = ${userId}
    `);
    return puzzleView(game, day, stage, puzzle, next, { hintsUsed: hintsUsed + Number(next.used_hint && !previous.used_hint) });
  });
}

export async function loadImage(game: Game, day: string, stage: number, slot: number, frame: Frame, userId: string) {
  if (!await stageIsUnlocked(game, day, stage, userId)) return;
  const opening = nameOpeningLevel(stage);
  const openingVariant = opening === null ? -1 : NAME_OPENING_VARIANT + opening;
  const result = await db.execute<{ image: Buffer }>(sql`
    select i.image from card_fragment_images i
    join card_fragment_puzzles p on (p.day, p.game, p.stage) = (i.day, i.game, i.stage) and p.answer_kind = 'pokemon'
    left join card_fragment_attempts a on a.game = i.game and a.day = i.day and a.stage = i.stage and a.user_id = ${userId}
    where i.game = ${game} and i.day = ${day} and i.stage = ${stage} and i.slot = ${slot} and i.frame = ${frame}
      and (i.game <> 'name' or i.variant < ${NAME_OPENING_VARIANT} or i.variant = ${openingVariant})
      and ((i.frame = 'close' and (a.started_at is not null or a.solved is not null)) or (i.frame = 'wide' and (a.used_hint or a.guesses > 0 or a.solved is not null))
        or (i.frame = 'reveal' and a.solved is not null))
    order by (i.game = 'name' and i.variant = ${openingVariant}) desc,
      case when i.game = 'odd' and i.frame = 'close' then (i.variant = ${oddVariant(stage)}) else false end desc,
      case when i.game = 'odd' then i.variant end, md5(concat(i.day, '/', i.stage, '/', i.slot, '/', i.variant)), i.variant
    limit 1
  `);
  return result.rows[0]?.image;
}

export async function loadRecords(game: Game, month: string, userId: string) {
  const monthStart = month + "-01";
  const [ranking, history] = await Promise.all([
    db.execute<{ rank: number; name: string; stars: number; wins: number; mine: boolean }>(sql`
      with totals as (
        select user_id, count(*)::int wins, count(*) filter (where guesses = 1 and not used_hint)::int stars
        from card_fragment_attempts
        where game = ${game} and day >= ${monthStart} and day < ${monthStart}::date + interval '1 month' and solved
        group by user_id
      ), ranked as (
        select *, rank() over (order by case when ${game} = 'name' then stars else 0 end desc, wins desc)::int rank
        from totals
      )
      select r.rank, coalesce(nullif(btrim(a.display_name), ''), nullif(btrim(u.name), ''), '플레이어') name,
        r.wins, r.stars, r.user_id = ${userId} as mine
      from ranked r join users u on u.id = r.user_id left join artists a on a.user_id = r.user_id
      where r.rank <= 10 or r.user_id = ${userId}
      order by r.rank, r.user_id
    `),
    db.execute<{ day: string; star: boolean }>(sql`
      select day::text, (guesses = 1 and not used_hint) as star from card_fragment_attempts
      where game = ${game} and user_id = ${userId} and solved order by day
    `),
  ]);
  const days = history.rows.filter((row) => game === "odd" || row.star);
  const winsByDay = new Map<string, number>();
  for (const { day } of history.rows) winsByDay.set(day, (winsByDay.get(day) ?? 0) + 1);
  const monthly = new Map<string, number>();
  for (const { day } of days) {
    const month = day.slice(0, 7);
    monthly.set(month, (monthly.get(month) ?? 0) + 1);
  }
  return {
    ranking: ranking.rows,
    bestMonth: Math.max(0, ...monthly.values()),
    bestRun: Math.max(0, ...winsByDay.values()),
    streak: longestStreak([...new Set(days.map((row) => row.day))]),
  };
}
