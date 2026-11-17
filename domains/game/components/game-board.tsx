"use client";

import { useCallback, useState } from "react";
import { showSuccessToast } from "@/lib/toast/gr-toast";
import type { GameStats } from "../engine/types";
import { useSubmitScore } from "../hooks";
import { GameCabinet } from "./game-cabinet";
import { GameCanvas, type GameUiState } from "./game-canvas";
import { GameHud } from "./game-hud";
import { GameLadder } from "./game-ladder";
import { GameLeaderboard } from "./game-leaderboard";

type Props = { currentUserId: string };

const INITIAL: GameUiState = { score: 0, nextTier: 1, queue: [], isGameOver: false };

export const GameBoard = ({ currentUserId }: Props) => {
  const [ui, setUi] = useState<GameUiState>(INITIAL);
  const [restartNonce, setRestartNonce] = useState(0);
  const [over, setOver] = useState<{ stats: GameStats; score: number } | null>(null);

  const [comment, setComment] = useState("");
  const submit = useSubmitScore();

  // onState/onGameOver는 안정적으로 유지(캔버스 effect 재생성 방지).
  const onState = useCallback((s: GameUiState) => setUi(s), []);
  // 제출은 오버레이에서 한줄평과 함께(아래 registerAndRestart).
  const onGameOver = useCallback((stats: GameStats, score: number) => {
    setOver({ stats, score });
  }, []);

  const registerAndRestart = () => {
    if (over) {
      submit.mutate(
        {
          score: over.score,
          ballsPlaced: over.stats.ballsPlaced,
          maxTier: over.stats.maxTier,
          durationMs: over.stats.durationMs,
          comment: comment.trim() || undefined,
        },
        { onSuccess: () => showSuccessToast("점수가 등록됐어요!") },
      );
    }
    setComment("");
    setOver(null);
    setUi(INITIAL);
    setRestartNonce((n) => n + 1);
  };

  return (
    <div className="-my-6 flex h-[calc(100dvh-3.5rem)] gap-4 overflow-hidden md:-my-10">
      {/* 왼쪽: HUD + 캐비닛 */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-2">
        <GameHud score={ui.score} nextTier={ui.nextTier} queue={ui.queue} />
        <GameCabinet>
          <div className="relative h-full w-full">
            <GameCanvas restartNonce={restartNonce} onState={onState} onGameOver={onGameOver} />
            {over && (
              <GameOverOverlay
                score={over.score}
                comment={comment}
                onComment={setComment}
                submitting={submit.isPending}
                onRegister={registerAndRestart}
              />
            )}
          </div>
        </GameCabinet>
      </div>

      {/* 오른쪽: 리더보드 + 볼 사다리 (데스크탑) */}
      <aside className="hidden w-[320px] shrink-0 flex-col gap-3 py-2 md:flex">
        <GameLeaderboard currentUserId={currentUserId} />
        <GameLadder />
      </aside>
    </div>
  );
};

type OverlayProps = {
  score: number;
  comment: string;
  onComment: (v: string) => void;
  submitting: boolean;
  onRegister: () => void;
};

const GameOverOverlay = ({ score, comment, onComment, submitting, onRegister }: OverlayProps) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl bg-black/70 px-6 text-white backdrop-blur-sm">
    <p className="text-3xl font-extrabold">게임 오버</p>
    <p className="text-lg">
      점수 <b className="tabular-nums">{score.toLocaleString()}</b>
    </p>
    <div className="flex w-full max-w-[260px] flex-col gap-1">
      <input
        value={comment}
        onChange={(e) => onComment(e.target.value.slice(0, 10))}
        maxLength={10}
        placeholder="한줄평 (최대 10자, 선택)"
        className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-center text-sm text-white placeholder:text-white/50 focus:border-white/60 focus:outline-none"
      />
      <span className="text-right text-[11px] text-white/50">{comment.length}/10</span>
    </div>
    <button
      type="button"
      onClick={onRegister}
      disabled={submitting}
      className="rounded-xl bg-[#EE1515] px-6 py-3 font-bold text-white transition hover:bg-red-600 disabled:opacity-60"
    >
      {submitting ? "등록 중…" : "등록하고 다시하기"}
    </button>
  </div>
);
