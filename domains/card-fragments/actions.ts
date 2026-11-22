"use server";

import { gamePlayerId } from "@/lib/game-player";
import { UUID } from "@/lib/uuid";
import { isGame, koreaDay, type Game, type RoundCommand } from "./rules";
import { submitGuess } from "./server";
import { continuePractice, startPractice } from "./practice";

function readGuess(game: Game, form: FormData): RoundCommand | null {
  const kind = form.get("kind");
  const value = form.get("value");
  if (kind === "start" || kind === "timeout") return kind;
  if (game === "name" && kind === "hint") return { kind };
  else if (game === "name" && kind === "name" && typeof value === "string" && value.trim() && value.length <= 40) {
    return { kind, value };
  } else if (game === "odd" && kind === "odd" && (value === "0" || value === "1" || value === "2")) {
    return { kind, value: Number(value) };
  }
  return null;
}

export async function playCardFragment(game: string, day: string, stage: number, expected: number, form: FormData) {
  const userId = await gamePlayerId();
  if (!userId) return { error: "로그인 후 다시 시도해 주세요." };
  if (day !== koreaDay()) return { error: "새 문제가 열렸어요. 페이지를 새로고침해 주세요." };
  if (!isGame(game) || !Number.isInteger(stage) || stage < 1 || stage > 2_147_483_646 || !Number.isInteger(expected) || expected < 0 || expected > 1) {
    return { error: "문제 진행 상태를 다시 확인해 주세요." };
  }

  const guess = readGuess(game, form);
  if (!guess) return { error: "답을 입력하거나 카드를 골라 주세요." };

  const puzzle = await submitGuess(game, day, stage, userId, expected, guess);
  return puzzle ? { puzzle } : { error: "오늘의 문제를 찾을 수 없어요." };
}

export async function beginCardFragmentPractice(game: string) {
  const userId = await gamePlayerId();
  if (!userId || !isGame(game)) return { error: "게임을 다시 열어 주세요." };
  const puzzle = await startPractice(game, koreaDay(), userId);
  return puzzle ? { puzzle } : { error: "오늘의 도전을 마치면 새 연습 게임을 시작할 수 있어요." };
}

export async function playCardFragmentPractice(game: string, day: string, runId: string, round: number, form: FormData) {
  const userId = await gamePlayerId();
  if (!userId || !isGame(game) || day !== koreaDay() || !UUID.test(runId) || !Number.isInteger(round) || round < 1 || round > 2_147_483_646) {
    return { error: "연습 게임을 다시 열어 주세요." };
  }
  const guess = form.get("kind") === "next" ? "next" : readGuess(game, form);
  if (!guess) return { error: "답을 입력하거나 카드를 골라 주세요." };
  const puzzle = await continuePractice(game, day, userId, runId, round, guess);
  return puzzle ? { puzzle } : { error: "연습 문제를 불러올 수 없어요." };
}
