"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { showErrorToast } from "@/lib/toast/gr-toast";
import { fetchLeaderboard } from "./api/actions";
import { GAME_ENDPOINTS } from "./api/endpoints";
import { gameKeys } from "./api/queries";
import type { LeaderboardScope, ScoreSubmission, SubmitScoreResult } from "./api/types";

export const useLeaderboard = (scope: LeaderboardScope) =>
  useQuery({
    queryKey: gameKeys.leaderboard(scope),
    queryFn: () => fetchLeaderboard(scope),
  });

// 게임오버 시 점수 제출. 4xx는 즉시 실패, 5xx·네트워크만 1회 재시도(spec §12).
export const useSubmitScore = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScoreSubmission) =>
      apiFetch<SubmitScoreResult>(GAME_ENDPOINTS.score, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    retry: (failureCount, error) => {
      if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
      return failureCount < 1;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: gameKeys.all });
    },
    onError: (error: unknown) => {
      showErrorToast(isApiError(error) ? (error.code ?? "internal") : "network");
    },
  });
};
