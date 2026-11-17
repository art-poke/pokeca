// 볼 사다리 범례 — 11단계 몬스터볼 진화 순서를 보여준다(플레이어가 목표를 알도록).

import { TIERS } from "../engine/ladder";
import { BallBadge } from "./ball-badge";

export const GameLadder = () => (
  <div className="shrink-0 rounded-2xl border border-[#e6e1d8] bg-white p-3 shadow-sm">
    <h2 className="mb-2 text-sm font-extrabold">🪜 볼 사다리 (11단계)</h2>
    <div className="grid grid-cols-6 gap-x-1 gap-y-2">
      {TIERS.map((t) => (
        <div key={t.tier} className="flex flex-col items-center gap-0.5">
          <BallBadge tier={t.tier} size={24} title />
          <span className="text-center text-[9px] leading-tight text-[#8a8178]">{t.name}</span>
        </div>
      ))}
    </div>
  </div>
);
