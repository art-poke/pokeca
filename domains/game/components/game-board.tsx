"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { showSuccessToast } from "@/lib/toast/gr-toast";
import type { GameStats } from "../engine/types";
import { useSubmitScore } from "../hooks";
import { GameCabinet } from "./game-cabinet";
import { GameCanvas, type GameUiState } from "./game-canvas";
import { GameHud } from "./game-hud";
import { GameLeaderboard } from "./game-leaderboard";

type Props = { currentUserId: string };

const INITIAL: GameUiState = { score: 0, nextTier: 1, queue: [], isGameOver: false };

export const GameBoard = ({ currentUserId }: Props) => {
  const [ui, setUi] = useState<GameUiState>(INITIAL);
  const [restartNonce, setRestartNonce] = useState(0);
  const [over, setOver] = useState<{ stats: GameStats; score: number } | null>(null);

  const submit = useSubmitScore();
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  // onState/onGameOver는 안정적으로 유지(캔버스 effect 재생성 방지). restart는 nonce로만.
  const onState = useCallback((s: GameUiState) => setUi(s), []);
  const onGameOver = useCallback((stats: GameStats, score: number) => {
    setOver({ stats, score });
    submitRef.current.mutate(
      { score, ballsPlaced: stats.ballsPlaced, maxTier: stats.maxTier, durationMs: stats.durationMs },
      { onSuccess: () => showSuccessToast("점수가 등록됐어요!") },
    );
  }, []);

  const restart = () => {
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
                maxTier={over.stats.maxTier}
                submitting={submit.isPending}
                failed={submit.isError}
                onRestart={restart}
              />
            )}
          </div>
        </GameCabinet>
      </div>

      {/* 오른쪽: 리더보드 (데스크탑) */}
      <aside className="hidden w-[320px] shrink-0 py-2 md:flex md:flex-col">
        <GameLeaderboard currentUserId={currentUserId} />
      </aside>
    </div>
  );
};

type OverlayProps = {
  score: number;
  maxTier: number;
  submitting: boolean;
  failed: boolean;
  onRestart: () => void;
};

const GameOverOverlay = ({ score, submitting, failed, onRestart }: OverlayProps) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl bg-black/70 text-white backdrop-blur-sm">
    <p className="text-3xl font-extrabold">게임 오버</p>
    <p className="text-lg">
      점수 <b className="tabular-nums">{score.toLocaleString()}</b>
    </p>
    <p className="text-xs text-white/70">
      {submitting ? "점수 등록 중…" : failed ? "점수 등록 실패 (잠시 후 다시)" : "점수가 등록됐어요"}
    </p>
    <button
      type="button"
      onClick={onRestart}
      className="rounded-xl bg-[#EE1515] px-6 py-3 font-bold text-white transition hover:bg-red-600"
    >
      다시 하기
    </button>
  </div>
);
