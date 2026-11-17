// 상단 HUD: 점수 + "다음 볼 공장" 컨베이어. 공장(왼쪽)에서 볼이 만들어져 벨트를 타고
// 크레인 투입구(오른쪽)로 온다. queue[0]이 가장 먼저 투입되므로 오른쪽에 둔다.

import { BallBadge } from "./ball-badge";

type Props = { score: number; nextTier: number; queue: number[] };

export const GameHud = ({ score, queue }: Props) => {
  // 오른쪽이 '곧 투입'(queue[0]). 공장에서 나온 신상은 왼쪽.
  const belt = [...queue].reverse();
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex items-baseline gap-1 rounded-xl bg-black/20 px-3 py-2 text-white">
        <b className="text-2xl tabular-nums leading-none">{score.toLocaleString()}</b>
        <span className="text-xs opacity-85">점</span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden rounded-xl bg-black/20 px-2 py-1">
        {/* 공장 */}
        <span className="flex items-center gap-1 text-base" title="볼 공장">
          <span className="animate-pulse">🏭</span>
        </span>
        {/* 벨트 */}
        <div
          className="flex flex-1 items-center gap-1 overflow-hidden rounded-md px-1 py-1"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg,#2a2e37 0 8px,#3a3f4a 8px 16px)",
          }}
        >
          {belt.map((tier, i) => (
            <BallBadge key={`${i}-${tier}`} tier={tier} size={22} title />
          ))}
        </div>
        {/* 투입구 */}
        <span className="whitespace-nowrap text-[10px] font-bold text-white/70">⬇ 투입</span>
      </div>
    </div>
  );
};
