// Query Key Factory — prefetch와 client query가 같은 키를 공유한다.
import type { LeaderboardScope } from "./types";

export const gameKeys = {
  all: ["game"] as const,
  leaderboard: (scope: LeaderboardScope) => [...gameKeys.all, "leaderboard", scope] as const,
};
