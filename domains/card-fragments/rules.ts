export const GAMES = {
  name: { title: "포켓몬 카드 보고 이름 맞히기", description: "카드 조각을 보고 포켓몬 이름을 맞히세요." },
  odd: { title: "다른 포켓몬을 찾아라", description: "세 장 중 카드에 적힌 메인 포켓몬 이름이 다른 한 장을 고르세요." },
} as const;

export type AnswerKind = "pokemon" | "trainer";
export type Game = keyof typeof GAMES;
export type Frame = "close" | "wide" | "reveal";
export const BANK_ROUNDS = 3;
export const ROUND_LIMIT_MS = 20_000;

export function parseRound(value: unknown) {
  if (typeof value !== "string" || !/^[1-9]\d{0,9}$/.test(value)) return 1;
  const round = Number(value);
  return round <= 2_147_483_646 ? round : 1;
}

export type Progress = {
  guesses: number;
  used_hint: boolean;
  solved: boolean | null;
  choice: number | null;
};

export const initialProgress: Progress = { guesses: 0, used_hint: false, solved: null, choice: null };

export type Guess = { kind: "hint" } | { kind: "name"; value: string } | { kind: "odd"; value: number };

export type RoundCommand = Guess | "start" | "timeout";
export const RUN_HINT_LIMIT = 2;
export type TimedProgress = Progress & { started_at: number | null; timed_out: boolean };
export const initialTimedProgress: TimedProgress = { ...initialProgress, started_at: null, timed_out: false };

export function applyRoundCommand(
  progress: TimedProgress,
  command: RoundCommand,
  answer: Parameters<typeof applyGuess>[2],
  now: Date,
  hintsUsed = 0,
): TimedProgress {
  if (progress.solved !== null) return progress;
  if (progress.started_at !== null && now.getTime() - progress.started_at >= ROUND_LIMIT_MS) {
    return { ...progress, solved: false, timed_out: true };
  }
  if (command === "start") return progress.started_at !== null ? progress : { ...progress, started_at: now.getTime() };
  if (progress.started_at === null || command === "timeout") return progress;
  if (command.kind === "hint" && (progress.used_hint || hintsUsed >= RUN_HINT_LIMIT)) return progress;
  return { ...progress, ...applyGuess(progress, command, answer) };
}

export function isGame(value: string): value is Game {
  return value === "name" || value === "odd";
}

export function koreaDay(now = new Date()) {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}

export function rankingMonth(value: unknown, today: string) {
  const current = today.slice(0, 7);
  return typeof value === "string" && /^[2-9]\d{3}-(0[1-9]|1[0-2])$/.test(value) && value <= current
    ? value
    : current;
}

export function moveMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7);
}

export function normalizeName(name: string) {
  return name.normalize("NFKC").replace(/\s+/gu, "").toLowerCase();
}

export function formatPlayTime(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const clock = [minutes, seconds % 60].map((part) => String(part).padStart(2, "0")).join(":");
  return hours ? `${hours}:${clock}` : clock;
}

export function currentFrame(progress: Progress): Frame {
  if (progress.solved !== null) return "reveal";
  return progress.guesses > 0 || progress.used_hint ? "wide" : "close";
}

export function applyGuess(
  progress: Progress,
  guess: Guess,
  answer: { name: string; aliases: string[]; slot: number },
): Progress {
  if (progress.solved !== null) return progress;
  if (guess.kind === "hint") return { ...progress, used_hint: true };
  const guesses = progress.guesses + 1;
  if (guess.kind === "odd") {
    return { ...progress, guesses, solved: guess.value === answer.slot, choice: guess.value };
  }

  const normalized = normalizeName(guess.value);
  const correct = [answer.name, ...answer.aliases].some((name) => normalizeName(name) === normalized);
  return { ...progress, guesses, solved: correct };
}

export function longestStreak(days: string[]) {
  let longest = 0;
  let running = 0;
  let previous = -Infinity;
  for (const day of days) {
    const current = Date.parse(day);
    running = current - previous === 86_400_000 ? running + 1 : 1;
    longest = Math.max(longest, running);
    previous = current;
  }
  return longest;
}
