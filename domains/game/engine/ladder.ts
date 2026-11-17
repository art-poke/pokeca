// 몬스터볼 수박게임 — 볼 사다리(11등급) + 월드/물리/드롭 상수.
// 여기가 게임 밸런스의 단일 소스. 숫자를 바꾸려면 이 파일만 고친다.
// 순수 TS(React/캔버스/matter.js 의존 0) — vitest로 그대로 테스트된다.

import type { Rng } from "./types";

export type TierConfig = {
  tier: number;
  name: string;
  radius: number; // 가상 월드 단위
  score: number; // 이 등급을 "생성"할 때 가산되는 점수
  droppable: boolean; // 크레인으로 떨어뜨릴 수 있는가
  topColor: string; // 볼 상단 색(#RRGGBB)
  accentColor: string; // 밴드/중앙 버튼 포인트 색(#RRGGBB)
};

// 생성 점수 = 삼각수 (T-1)*T/2. tier1 = 0(드롭만).
const triScore = (tier: number): number => ((tier - 1) * tier) / 2;

export const TIERS: readonly TierConfig[] = [
  { tier: 1, name: "몬스터볼", radius: 16, score: triScore(1), droppable: true, topColor: "#EE1515", accentColor: "#B00D0D" },
  { tier: 2, name: "수퍼볼", radius: 22, score: triScore(2), droppable: true, topColor: "#2F6DB5", accentColor: "#D13B3B" },
  { tier: 3, name: "하이퍼볼", radius: 30, score: triScore(3), droppable: true, topColor: "#E6B422", accentColor: "#1A1A1A" },
  { tier: 4, name: "프리미어볼", radius: 38, score: triScore(4), droppable: true, topColor: "#F5F5F5", accentColor: "#EE1515" },
  { tier: 5, name: "다크볼", radius: 46, score: triScore(5), droppable: true, topColor: "#2E3B33", accentColor: "#39C07A" },
  { tier: 6, name: "네스트볼", radius: 56, score: triScore(6), droppable: false, topColor: "#7AB648", accentColor: "#E8A13B" },
  { tier: 7, name: "타이머볼", radius: 68, score: triScore(7), droppable: false, topColor: "#D7D2CB", accentColor: "#D13B3B" },
  { tier: 8, name: "퀵볼", radius: 82, score: triScore(8), droppable: false, topColor: "#30B8D8", accentColor: "#F2C933" },
  { tier: 9, name: "힐볼", radius: 98, score: triScore(9), droppable: false, topColor: "#F09BC0", accentColor: "#EE5FA0" },
  { tier: 10, name: "러브볼", radius: 116, score: triScore(10), droppable: false, topColor: "#E85A9B", accentColor: "#FFFFFF" },
  { tier: 11, name: "마스터볼", radius: 136, score: triScore(11), droppable: false, topColor: "#5A2D8C", accentColor: "#E24B9A" },
] as const;

export const MAX_TIER = TIERS.length; // 11

// ── 가상 월드 / 물리 ────────────────────────────────────────────────
export const WORLD_WIDTH = 360;
export const WORLD_HEIGHT = 540;
export const WALL_THICKNESS = 60;
export const DEADLINE_Y = 100; // 이 위(y가 더 작음)에 공이 머물면 게임오버
export const GRAVITY_Y = 1;
export const FIXED_DT = 1000 / 60; // 물리 고정 타임스텝(ms)

// ── 드롭 / 게임오버 ─────────────────────────────────────────────────
export const DROP_COOLDOWN_MS = 500; // 연속 드롭 최소 간격
export const DROP_GRACE_MS = 600; // 드롭 직후 이 시간 동안은 그 공을 게임오버 판정에서 제외
export const GAME_OVER_MS = 1000; // 데드라인 위 연속 체류 임계
export const MASTER_POP_BONUS = 100; // 마스터볼끼리 머지 시 보너스

// 드롭 가능한 하위 5등급의 등장 가중치(작은 볼일수록 자주).
export const DROP_WEIGHTS: readonly number[] = [0.3, 0.28, 0.22, 0.14, 0.06];

export const tierConfig = (tier: number): TierConfig => {
  const cfg = TIERS[tier - 1];
  if (!cfg) throw new RangeError(`invalid tier: ${tier}`);
  return cfg;
};

export const nextTier = (tier: number): number | null =>
  tier >= MAX_TIER ? null : tier + 1;

export const droppableTiers = (): number[] =>
  TIERS.filter((t) => t.droppable).map((t) => t.tier);

// 주입식 RNG(0..1)로 가중치 버킷을 골라 드롭 등급을 결정 → 테스트 결정론.
export const pickDropTier = (rng: Rng): number => {
  const r = rng();
  let cum = 0;
  for (let i = 0; i < DROP_WEIGHTS.length; i++) {
    cum += DROP_WEIGHTS[i];
    if (r < cum) return i + 1;
  }
  return DROP_WEIGHTS.length; // 부동소수 잔차 보호
};
