"use client";

import { useEffect, useRef } from "react";
import {
  CEILING_Y,
  DEADLINE_Y,
  FIXED_DT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  tierConfig,
} from "@/domains/game/engine/ladder";
import { Game } from "@/domains/game/engine/game";
import type { GameStats } from "@/domains/game/engine/types";
import { clearBallSpriteCache, getBallSprite } from "./ball-sprites";
import { EffectSystem } from "./effects";

export type GameUiState = {
  score: number;
  nextTier: number;
  queue: number[];
  isGameOver: boolean;
};

type Props = {
  restartNonce: number; // 값이 바뀌면 새 게임 시작
  onState: (s: GameUiState) => void;
  onGameOver: (stats: GameStats, score: number) => void;
};

const CRANE_Y = 30; // 크레인이 공을 떨어뜨리는 높이(가상 월드)
const MAX_FRAME_MS = 50; // 탭 복귀 등으로 dt가 튀는 것 방지

export const GameCanvas = ({ restartNonce, onState, onGameOver }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fx = new EffectSystem();
    const game = new Game({ rng: Math.random, onMerge: (e) => fx.spawnMerge(e) });

    let raf = 0;
    let lastTs = 0;
    let acc = 0;
    let paused = false;
    let gameOverSent = false;
    let last = "";

    // 레터박스 유니폼 스케일: 컨테이너 비율과 무관하게 탱크 전체가 보이도록 맞춘다.
    const metrics = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(rect.width / WORLD_WIDTH, rect.height / WORLD_HEIGHT);
      const offsetX = (rect.width - WORLD_WIDTH * scale) / 2;
      const offsetY = (rect.height - WORLD_HEIGHT * scale) / 2;
      return { rect, scale, offsetX, offsetY };
    };

    const worldXFromClient = (clientX: number): number => {
      const { rect, scale, offsetX } = metrics();
      return (clientX - rect.left - offsetX) / scale;
    };

    const emitState = () => {
      const s = game.getSnapshot();
      const key = `${s.score}|${s.nextTier}|${s.queue.join(",")}|${s.isGameOver}`;
      if (key !== last) {
        last = key;
        onState({ score: s.score, nextTier: s.nextTier, queue: s.queue, isGameOver: s.isGameOver });
      }
    };

    const draw = () => {
      const { rect, scale: s, offsetX, offsetY } = metrics();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const worldH = WORLD_HEIGHT;

      // 레터박스 배경(탱크 바깥).
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0d0d0f";
      ctx.fillRect(0, 0, rect.width, rect.height);

      // 월드 좌표계로 전환: 1 world unit = (dpr*s) device px, 레터박스 오프셋 적용.
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * offsetX, dpr * offsetY);

      // 탱크 배경.
      ctx.fillStyle = "#141b24";
      ctx.fillRect(0, 0, WORLD_WIDTH, worldH);

      const snap = game.getSnapshot();
      const warning = snap.warningMs != null;

      // 천장(최상단): 닿으면 즉시 탈락.
      ctx.strokeStyle = "rgba(255,40,40,0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(0, CEILING_Y);
      ctx.lineTo(WORLD_WIDTH, CEILING_Y);
      ctx.stroke();
      ctx.setLineDash([]);

      // 경고선(데드라인). 경고 중엔 빨갛게 강조.
      ctx.strokeStyle = warning ? "rgba(255,40,40,0.95)" : "rgba(255,90,90,0.7)";
      ctx.lineWidth = warning ? 2.5 : 1.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(0, DEADLINE_Y);
      ctx.lineTo(WORLD_WIDTH, DEADLINE_Y);
      ctx.stroke();
      ctx.setLineDash([]);

      // 경고 카운트다운(정리까지 남은 초).
      if (warning) {
        const secs = Math.ceil((snap.warningMs ?? 0) / 1000);
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,60,60,0.95)";
        ctx.font = "bold 36px system-ui, sans-serif";
        ctx.fillText(`${secs}`, WORLD_WIDTH / 2, DEADLINE_Y - 16);
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.fillText("초 안에 정리하세요!", WORLD_WIDTH / 2, DEADLINE_Y - 44);
      }

      // 쌓인 볼들.
      for (const b of snap.balls) {
        const sprite = getBallSprite(b.tier, b.radius * s * dpr);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        ctx.drawImage(sprite, -b.radius, -b.radius, b.radius * 2, b.radius * 2);
        ctx.restore();
      }

      // 크레인: 케이블 + 집게 + 들고 있는 다음 볼.
      if (!snap.isGameOver) {
        const hx = snap.dropX;
        const held = tierConfig(snap.nextTier);
        ctx.strokeStyle = "#cfd3da";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hx, 0);
        ctx.lineTo(hx, CRANE_Y - held.radius);
        ctx.stroke();
        // 집게(간단한 삼각형 두 개).
        ctx.fillStyle = "#aeb4bf";
        ctx.beginPath();
        ctx.moveTo(hx - held.radius * 0.6, CRANE_Y - held.radius);
        ctx.lineTo(hx + held.radius * 0.6, CRANE_Y - held.radius);
        ctx.lineTo(hx, CRANE_Y - held.radius + 8);
        ctx.closePath();
        ctx.fill();
        // 들고 있는 볼 + 드롭 가이드라인.
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(hx, CRANE_Y + held.radius);
        ctx.lineTo(hx, worldH);
        ctx.stroke();
        ctx.setLineDash([]);
        const sprite = getBallSprite(snap.nextTier, held.radius * s * dpr);
        ctx.drawImage(sprite, hx - held.radius, CRANE_Y - held.radius, held.radius * 2, held.radius * 2);
      }

      // 머지 이펙트(월드 좌표).
      fx.draw(ctx);
    };

    const loop = (ts: number) => {
      if (!lastTs) lastTs = ts;
      const dt = Math.min(ts - lastTs, MAX_FRAME_MS);
      lastTs = ts;
      if (!paused) {
        acc += dt;
        while (acc >= FIXED_DT) {
          game.step(FIXED_DT);
          acc -= FIXED_DT;
        }
        fx.update(dt);
        draw();
        emitState();
        const snap = game.getSnapshot();
        if (snap.isGameOver && !gameOverSent) {
          gameOverSent = true;
          onGameOver(game.getStats(), snap.score);
        }
      }
      raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => game.setDropX(worldXFromClient(e.clientX));
    const onPointerDown = (e: PointerEvent) => {
      game.setDropX(worldXFromClient(e.clientX));
      game.drop(worldXFromClient(e.clientX));
    };
    const onVisibility = () => {
      paused = document.hidden;
      if (!paused) lastTs = 0; // 복귀 시 dt 리셋
    };

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("visibilitychange", onVisibility);
      clearBallSpriteCache();
    };
  }, [restartNonce, onState, onGameOver]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="game-canvas"
      className="block h-full w-full touch-none select-none rounded-xl"
    />
  );
};
