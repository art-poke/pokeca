// 인형뽑기 캐비닛 프레임(장식). 유리 탱크(캔버스)를 children으로 감싼다.

import type { ReactNode } from "react";

type Props = { children: ReactNode };

export const GameCabinet = ({ children }: Props) => (
  <div className="flex min-h-0 flex-1 flex-col rounded-3xl bg-gradient-to-b from-[#ff3b3b] via-[#EE1515] to-[#B00D0D] p-3 shadow-[0_20px_40px_-18px_rgba(176,13,13,0.7)]">
    {/* 간판(마키) */}
    <div className="mb-2 flex items-center justify-center gap-2 rounded-xl bg-[#1A1A1A] py-2 text-sm font-extrabold tracking-widest text-white">
      <span className="h-2 w-2 rounded-full bg-[#ffd34d] shadow-[0_0_8px_#ffd34d]" />
      MONSTER BALL DROP
      <span className="h-2 w-2 rounded-full bg-[#ffd34d] shadow-[0_0_8px_#ffd34d]" />
    </div>
    {/* 유리 탱크 프레임 */}
    <div className="flex min-h-0 flex-1 justify-center rounded-2xl bg-[#0d0d0f] p-2">
      {children}
    </div>
  </div>
);
