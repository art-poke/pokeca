"use server";

import { gamePlayerId } from "@/lib/game-player";
import { getLeaderboard } from "@/lib/game";
import type { LeaderboardResult, LeaderboardScope } from "./types";

// 읽기 서버액션 — 같은 Next 안에서 lib/game을 직접 호출(네트워크 홉 없음).
// 현재 로그인 유저 기준 "내 순위"를 함께 내려준다. 실패 시 throw → react-query가 처리.
export const fetchLeaderboard = async (scope: LeaderboardScope): Promise<LeaderboardResult> => {
  const userId = await gamePlayerId();
  return getLeaderboard(scope, { userId });
};
