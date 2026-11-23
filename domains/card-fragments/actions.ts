"use server";

import { gamePlayerId } from "@/lib/game-player";
import { UUID } from "@/lib/uuid";
import { isGame, koreaDay, type Game, type RoundCommand } from "./rules";
import { continueRun, startRun } from "./run";

function readCommand(game: Game, form: FormData): RoundCommand | "next" | null {
  const kind = form.get("kind");
  const value = form.get("value");
  if (kind === "start" || kind === "timeout" || kind === "next") return kind;
  if (game === "name" && kind === "hint") return { kind };
  if (game === "name" && kind === "name" && typeof value === "string" && value.trim() && value.length <= 40) return { kind, value };
  if (game === "odd" && kind === "odd" && (value === "0" || value === "1" || value === "2")) return { kind, value: Number(value) };
  return null;
}

export async function beginCardFragmentRun(game: string) {
  const userId = await gamePlayerId();
  if (!userId || !isGame(game)) return { error: "게임을 다시 열어 주세요." };
  const puzzle = await startRun(game, koreaDay(), userId);
  return puzzle ? { puzzle } : { error: "준비된 문제를 불러올 수 없어요." };
}

export async function playCardFragmentRun(game: string, runId: string, round: number, expected: number, form: FormData) {
  const userId = await gamePlayerId();
  if (!userId || !isGame(game) || !UUID.test(runId) || !Number.isInteger(round) || round < 1 || round > 2_147_483_646
      || !Number.isInteger(expected) || expected < 0 || expected > 1) {
    return { error: "게임을 다시 열어 주세요." };
  }
  const command = readCommand(game, form);
  if (!command) return { error: "답을 입력하거나 카드를 골라 주세요." };
  const puzzle = await continueRun(game, userId, runId, round, expected, command);
  return puzzle ? { puzzle } : { error: "이 게임은 종료됐어요. 페이지를 다시 열어 주세요." };
}
