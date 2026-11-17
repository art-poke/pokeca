// 몬스터볼을 코드로 그려 오프스크린 캔버스에 캐시한다(공식 스프라이트 미사용 — 저작권 회피).
// 포켓볼 = 상/하 2색 분할 + 가운데 밴드 + 중앙 버튼(흰 링 + accent 점) + 음영.
// deviceRadius(디바이스 픽셀 반지름) 단위로 그려 캐시 → 렌더러는 drawImage만.

import { tierConfig } from "@/domains/game/engine/ladder";

const cache = new Map<string, HTMLCanvasElement>();
const PI2 = Math.PI * 2;

const renderBallSprite = (tier: number, deviceRadius: number): HTMLCanvasElement => {
  const cfg = tierConfig(tier);
  const r = deviceRadius;
  const size = Math.ceil(r * 2);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = r;
  const cy = r;

  // 원 클립 안에서 상/하 색 + 밴드 + 음영.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, PI2);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = cfg.topColor;
  ctx.fillRect(0, 0, size, cy);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, cy, size, size - cy);
  ctx.fillStyle = "#1A1A1A";
  ctx.fillRect(0, cy - r * 0.14, size, r * 0.28);

  // 구체 음영(좌상단 하이라이트 → 우하단 그림자).
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, "rgba(255,255,255,0.4)");
  g.addColorStop(0.55, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  // 중앙 버튼: 검은 링 → 흰 원 → accent 점.
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.3, 0, PI2);
  ctx.fillStyle = "#1A1A1A";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.21, 0, PI2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.1, 0, PI2);
  ctx.fillStyle = cfg.accentColor;
  ctx.fill();

  // 외곽 테두리.
  ctx.beginPath();
  ctx.arc(cx, cy, r - 1, 0, PI2);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.stroke();

  return canvas;
};

export const getBallSprite = (tier: number, deviceRadius: number): HTMLCanvasElement => {
  const r = Math.max(6, Math.round(deviceRadius));
  const key = `${tier}:${r}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sprite = renderBallSprite(tier, r);
  cache.set(key, sprite);
  return sprite;
};

export const clearBallSpriteCache = (): void => cache.clear();
