// 상단 HUD: 점수 + "다음 볼 공장" 컨베이어. 왼쪽이 '곧 투입'(queue[0]=다음 순서),
// 오른쪽 공장에서 새 볼이 만들어져 벨트를 타고 왼쪽으로 흘러온다.

import { BallBadge } from "./ball-badge";

type Props = { score: number; nextTier: number; queue: number[] };

export const GameHud = ({ score, queue }: Props) => {
  // queue[0]이 가장 먼저 투입 → 왼쪽에 둔다(자연 순서 그대로).
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex items-baseline gap-1 rounded-xl bg-black/20 px-3 py-2 text-white">
        <b className="text-2xl tabular-nums leading-none">{score.toLocaleString()}</b>
        <span className="text-xs opacity-85">점</span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden rounded-xl bg-black/20 px-2 py-1">
        {/* 다음 투입(왼쪽) */}
        <span className="whitespace-nowrap text-[10px] font-bold text-white/70">다음 ⬇</span>
        {/* 벨트: 왼쪽 queue[0]부터 */}
        <div
          className="flex flex-1 items-center gap-1 overflow-hidden rounded-md px-1 py-1"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg,#2a2e37 0 8px,#3a3f4a 8px 16px)",
          }}
        >
          {queue.map((tier, i) => (
            <BallBadge key={`${i}-${tier}`} tier={tier} size={i === 0 ? 26 : 22} title />
          ))}
        </div>
        {/* 공장(오른쪽) — 새 볼 생산 */}
        <span className="flex items-center gap-1 text-base" title="볼 공장">
          <span className="animate-pulse">🏭</span>
        </span>
      </div>
    </div>
  );
};
