// 머지 규칙(순수). 같은 등급 두 볼이 닿았을 때의 결과만 계산한다.
// matter.js 바디를 모르므로 단위 테스트가 쉽다. game.ts가 충돌 지점에서 이걸 호출한다.

import { MASTER_POP_BONUS, nextTier, tierConfig } from "./ladder";

export type MergeResult = {
  nextTier: number | null; // 새로 생성될 등급(마스터끼리면 null)
  score: number; // 이번 머지로 가산될 점수
  isMaster: boolean; // 최고 등급끼리 터진 경우
};

export const resolveMerge = (tier: number): MergeResult => {
  const next = nextTier(tier);
  if (next === null) {
    // 마스터볼끼리: 다음 등급 없음 → 둘 다 터지고 보너스.
    return { nextTier: null, score: MASTER_POP_BONUS, isMaster: true };
  }
  return { nextTier: next, score: tierConfig(next).score, isMaster: false };
};
