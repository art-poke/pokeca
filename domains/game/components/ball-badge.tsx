// DOM용 몬스터볼 뱃지(CSS). HUD 컨베이어·리더보드 범례 등 캔버스 밖 미리보기에 쓴다.
// 캔버스 안 실제 볼은 ball-sprites.ts가 그린다(여긴 가벼운 프리뷰용).

import { tierConfig } from "@/domains/game/engine/ladder";

type Props = { tier: number; size: number; title?: boolean };

export const BallBadge = ({ tier, size, title }: Props) => {
  const cfg = tierConfig(tier);
  const band = Math.max(2, size * 0.14);
  const btn = size * 0.42;
  const dot = size * 0.2;
  return (
    <span
      title={title ? cfg.name : undefined}
      aria-label={cfg.name}
      style={{
        position: "relative",
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(180deg, ${cfg.topColor} 0 calc(50% - 0.5px), #fff calc(50% + 0.5px) 100%)`,
        boxShadow:
          "inset -3px -4px 7px rgba(0,0,0,0.28), inset 3px 3px 6px rgba(255,255,255,0.45), 0 1px 3px rgba(0,0,0,0.3)",
        flex: "none",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          height: band,
          background: "#1A1A1A",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%)",
          width: btn,
          height: btn,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: `0 0 0 ${Math.max(1, size * 0.05)}px #1A1A1A`,
          display: "grid",
          placeItems: "center",
        }}
      >
        <span style={{ width: dot, height: dot, borderRadius: "50%", background: cfg.accentColor }} />
      </span>
    </span>
  );
};
