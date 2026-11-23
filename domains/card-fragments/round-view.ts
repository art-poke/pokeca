import "server-only";
import { cardPath } from "@/lib/search";
import { runtimeCrop, nameOpeningLevel, type CropSource, type CardPlacement, type NamePlacements } from "./crop";
import { ROUND_LIMIT_MS, RUN_HINT_LIMIT, type Frame, type Game, type TimedProgress } from "./rules";

export type Card = {
  name: string;
  set: string;
  number: string;
  detailUrl?: string;
  cameo?: string;
  shiny?: boolean;
  cropSource?: CropSource;
  placement?: CardPlacement;
  placements?: CardPlacement[];
  namePlacements?: NamePlacements;
  openingPlacements?: NamePlacements;
};

export type Puzzle = { cards: Card[]; answer_slot: number; aliases: string[] };

export function puzzleView(game: Game, day: string, round: number, puzzle: Puzzle, progress: TimedProgress,
  runId: string, variant: number, hintsUsed: number,
) {
  const image = (slot: number, frame: Frame) =>
    `/api/card-fragments/${game}/${slot}/${frame}?stage=${round}&run=${runId}`;
  const nameFrame = progress.used_hint ? "wide" : "close";
  const fragments = puzzle.cards.map((card, slot) => {
    const frame = game === "odd" ? "close" : nameFrame;
    const level = nameOpeningLevel(round);
    const placement = card.cropSource
      ? runtimeCrop(card.cropSource, game, round, runId, slot, frame).placement
      : game === "odd"
        ? card.placements?.[variant] ?? card.placement
        : (level === null ? undefined : card.openingPlacements?.[nameFrame][level]) ??
          card.namePlacements?.[nameFrame][variant] ?? card.namePlacements?.[nameFrame][0];
    return { image: image(slot, frame), placement };
  });
  return {
    day,
    stage: round,
    runId,
    hintsRemaining: Math.max(0, RUN_HINT_LIMIT - hintsUsed),
    fragments,
    progress: { guesses: progress.guesses, used_hint: progress.used_hint, solved: progress.solved, choice: progress.choice },
    deadline: progress.started_at === null ? null : progress.started_at + ROUND_LIMIT_MS,
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
