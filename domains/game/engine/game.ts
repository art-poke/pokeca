// 게임 상태기계. 물리(physics) + 머지(merge) + 게임오버(deadline)를 엮어
// 드롭/스텝/스냅샷/통계를 제공한다. 시간은 step(dt) 누적으로만 다룬다(Date 미사용 → 결정론).
// 머지 이펙트 등 비주얼은 onMerge 이벤트만 쏘고 렌더러가 처리한다(엔진 순수성 유지).

import Matter from "matter-js";
import {
  CEILING_Y,
  DEADLINE_Y,
  DROP_COOLDOWN_MS,
  DROP_GRACE_MS,
  GAME_OVER_MS,
  WORLD_WIDTH,
  pickDropTier,
  tierConfig,
} from "./ladder";
import { BALL_LABEL, createPhysics, type Physics } from "./physics";
import { resolveMerge } from "./merge";
import { DeadlineWatcher } from "./deadline";
import type { GameSnapshot, GameStats, MergeEvent, Rng } from "./types";

const { Events } = Matter;

const SPAWN_Y = 36; // 데드라인(100) 위에서 떨어뜨린다
const DEFAULT_QUEUE = 3;

// physics가 심는 {tier,ballId}에 게임이 스폰시각/머지플래그를 덧붙인다.
type GamePlugin = { tier: number; ballId: number; spawnAt: number; merged: boolean };

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export type GameOptions = {
  rng: Rng;
  onMerge?: (e: MergeEvent) => void;
  queueSize?: number;
};

export class Game {
  private readonly physics: Physics;
  private readonly watcher: DeadlineWatcher;
  private readonly rng: Rng;
  private readonly onMerge?: (e: MergeEvent) => void;

  private score = 0;
  private elapsed = 0;
  private lastDropAt = -Infinity;
  private ballsPlaced = 0;
  private maxTier = 0;
  private isGameOver = false;

  private current: number;
  private upcoming: number[];
  private dropX = WORLD_WIDTH / 2;

  // 이번 스텝의 충돌에서 모은 머지 대상 쌍(스텝 종료 후 처리).
  private pending: Array<[Matter.Body, Matter.Body]> = [];

  constructor(opts: GameOptions) {
    this.rng = opts.rng;
    this.onMerge = opts.onMerge;
    this.physics = createPhysics();
    this.watcher = new DeadlineWatcher(DEADLINE_Y, DROP_GRACE_MS, GAME_OVER_MS, CEILING_Y);

    const q = opts.queueSize ?? DEFAULT_QUEUE;
    this.current = pickDropTier(this.rng);
    this.upcoming = Array.from({ length: q }, () => pickDropTier(this.rng));

    Events.on(this.physics.engine, "collisionStart", (ev) => {
      for (const pair of ev.pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;
        if (a.label !== BALL_LABEL || b.label !== BALL_LABEL) continue;
        const pa = a.plugin as GamePlugin;
        const pb = b.plugin as GamePlugin;
        if (pa.merged || pb.merged) continue;
        if (pa.tier !== pb.tier) continue;
        pa.merged = true;
        pb.merged = true;
        this.pending.push([a, b]);
      }
    });
  }

  // 크레인 미리보기 위치만 갱신(실제 드롭과 무관).
  setDropX(x: number): void {
    this.dropX = clamp(x, 0, WORLD_WIDTH);
  }

  // 성공적으로 떨어뜨렸으면 true. 게임오버/쿨다운이면 false.
  drop(x: number): boolean {
    if (this.isGameOver) return false;
    if (this.elapsed - this.lastDropAt < DROP_COOLDOWN_MS) return false;

    const tier = this.current;
    const radius = tierConfig(tier).radius;
    const px = clamp(x, radius, WORLD_WIDTH - radius);
    const body = this.physics.addBall(tier, px, SPAWN_Y);
    const plugin = body.plugin as GamePlugin;
    plugin.spawnAt = this.elapsed;
    plugin.merged = false;

    this.ballsPlaced += 1;
    this.maxTier = Math.max(this.maxTier, tier);
    this.lastDropAt = this.elapsed;
    this.dropX = px;

    this.current = this.upcoming.shift() ?? pickDropTier(this.rng);
    this.upcoming.push(pickDropTier(this.rng));
    return true;
  }

  step(dt: number): void {
    if (this.isGameOver) return;

    this.pending = [];
    this.physics.step(dt);

    for (const [a, b] of this.pending) {
      const tier = (a.plugin as GamePlugin).tier;
      const mx = (a.position.x + b.position.x) / 2;
      const my = (a.position.y + b.position.y) / 2;
      this.physics.removeBall(a);
      this.physics.removeBall(b);

      const res = resolveMerge(tier);
      this.score += res.score;
      if (res.nextTier !== null) {
        const nb = this.physics.addBall(res.nextTier, mx, my);
        const np = nb.plugin as GamePlugin;
        np.spawnAt = this.elapsed;
        np.merged = false;
        this.maxTier = Math.max(this.maxTier, res.nextTier);
      }
      this.onMerge?.({
        x: mx,
        y: my,
        tier: res.nextTier ?? tier,
        score: res.score,
        isMaster: res.isMaster,
      });
    }

    this.elapsed += dt;

    const balls = this.physics.getBalls().map((bd) => {
      const p = bd.plugin as GamePlugin;
      const radius = bd.circleRadius ?? tierConfig(p.tier).radius;
      return { id: p.ballId, topY: bd.position.y - radius, ageMs: this.elapsed - p.spawnAt };
    });
    if (this.watcher.update(dt, balls)) this.isGameOver = true;
  }

  getSnapshot(): GameSnapshot {
    const balls = this.physics.getBalls().map((bd) => {
      const p = bd.plugin as GamePlugin;
      return {
        id: p.ballId,
        tier: p.tier,
        x: bd.position.x,
        y: bd.position.y,
        radius: bd.circleRadius ?? tierConfig(p.tier).radius,
        angle: bd.angle,
      };
    });
    const danger = this.watcher.dangerMs();
    const warningMs = this.isGameOver || danger <= 0 ? null : Math.max(0, GAME_OVER_MS - danger);
    return {
      score: this.score,
      nextTier: this.current,
      queue: [...this.upcoming],
      dropX: this.dropX,
      isGameOver: this.isGameOver,
      warningMs,
      balls,
    };
  }

  getStats(): GameStats {
    return {
      ballsPlaced: this.ballsPlaced,
      maxTier: this.maxTier,
      durationMs: Math.round(this.elapsed),
    };
  }
}
