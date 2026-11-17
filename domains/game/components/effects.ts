// 머지 "손맛" 이펙트. 엔진이 쏜 onMerge 이벤트를 받아 파티클/확산링/플로팅점수를 뿌린다.
// 렌더러 전용 — 엔진은 이 파일을 모른다. update/spawn은 순수 배열 연산이라 테스트된다.
// draw(ctx, scale)만 canvas 2D 컨텍스트를 쓴다(테스트에서는 호출하지 않음).

import { tierConfig } from "@/domains/game/engine/ladder";
import type { MergeEvent } from "@/domains/game/engine/types";

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string };
type Ring = { x: number; y: number; life: number; max: number; from: number; to: number; color: string };
type Float = { x: number; y: number; life: number; max: number; text: string };

const PARTICLE_MS = 600;
const RING_MS = 420;
const FLOAT_MS = 900;

export class EffectSystem {
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private floats: Float[] = [];

  spawnMerge(ev: MergeEvent): void {
    const cfg = tierConfig(ev.tier);
    const color = cfg.topColor;
    const n = ev.isMaster ? 28 : 12;
    const speed = ev.isMaster ? 0.32 : 0.2;

    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const v = speed * (0.6 + Math.random() * 0.8);
      this.particles.push({
        x: ev.x,
        y: ev.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: PARTICLE_MS,
        max: PARTICLE_MS,
        size: (ev.isMaster ? 5 : 3) + Math.random() * 3,
        color: i % 3 === 0 ? cfg.accentColor : color,
      });
    }

    this.rings.push({
      x: ev.x,
      y: ev.y,
      life: RING_MS,
      max: RING_MS,
      from: cfg.radius * 0.6,
      to: cfg.radius * (ev.isMaster ? 2.4 : 1.6),
      color,
    });

    this.floats.push({
      x: ev.x,
      y: ev.y,
      life: FLOAT_MS,
      max: FLOAT_MS,
      text: `+${ev.score}`,
    });
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.0012 * dt; // 약한 중력
      p.life -= dt;
    }
    for (const r of this.rings) r.life -= dt;
    for (const f of this.floats) {
      f.y -= 0.03 * dt; // 위로 떠오름
      f.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    this.rings = this.rings.filter((r) => r.life > 0);
    this.floats = this.floats.filter((f) => f.life > 0);
  }

  // 활성 이펙트 총 개수(테스트/디버그용).
  count(): number {
    return this.particles.length + this.rings.length + this.floats.length;
  }

  // 가상 월드 좌표를 scale배로 그린다. ctx는 이미 캔버스 원점/스케일이 맞춰진 상태라고 가정.
  draw(ctx: CanvasRenderingContext2D): void {
    for (const r of this.rings) {
      const t = 1 - r.life / r.max;
      const radius = r.from + (r.to - r.from) * t;
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.font = "bold 20px system-ui, sans-serif";
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, f.life / f.max);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
}
