"use client";

import { useState } from "react";
import { useLeaderboard } from "../hooks";
import type { LeaderboardScope } from "../api/types";

type Props = { currentUserId: string };

const TABS: { key: LeaderboardScope; label: string }[] = [
  { key: "month", label: "이번 달" },
  { key: "all", label: "역대 최고" },
];

export const GameLeaderboard = ({ currentUserId }: Props) => {
  const [scope, setScope] = useState<LeaderboardScope>("month");
  const { data, isLoading, isError } = useLeaderboard(scope);

  const meInTop = data?.entries.some((e) => e.userId === currentUserId) ?? false;

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[#e6e1d8] bg-white p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold">🏆 리더보드</h2>

      <div className="mb-3 flex gap-1 rounded-lg bg-[#f4f1ec] p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setScope(t.key)}
            className={`flex-1 rounded-md py-2 text-xs font-bold transition ${
              scope === t.key ? "bg-white text-[#1A1A1A] shadow" : "text-[#8a8178]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && <p className="py-6 text-center text-sm text-[#8a8178]">불러오는 중…</p>}
        {isError && (
          <p className="py-6 text-center text-sm text-[#8a8178]">리더보드를 불러오지 못했어요.</p>
        )}
        {data && data.entries.length === 0 && (
          <p className="py-6 text-center text-sm text-[#8a8178]">아직 기록이 없어요. 첫 주인공이 되어보세요!</p>
        )}
        {data &&
          data.entries.map((e) => (
            <Row
              key={e.userId}
              rank={e.rank}
              name={e.name}
              image={e.image}
              score={e.score}
              me={e.userId === currentUserId}
            />
          ))}
      </div>

      {data?.me && !meInTop && (
        <div className="mt-2 border-t border-[#e6e1d8] pt-2">
          <Row rank={data.me.rank} name="나" image={null} score={data.me.score} me />
        </div>
      )}
    </div>
  );
};

type RowProps = { rank: number; name: string; image: string | null; score: number; me: boolean };

const Row = ({ rank, name, image, score, me }: RowProps) => (
  <div
    className={`flex items-center gap-2 px-1.5 py-2 text-sm ${
      me ? "rounded-lg bg-[#fff4f4] outline outline-1 outline-[#ffd3d3]" : "border-b border-[#f0ece4]"
    }`}
  >
    <span className={`w-6 text-center font-extrabold ${rank <= 3 ? "text-[#EE1515]" : "text-[#8a8178]"}`}>
      {rank}
    </span>
    {image ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" className="h-6 w-6 rounded-full object-cover" />
    ) : (
      <span className="h-6 w-6 flex-none rounded-full bg-[#ddd]" />
    )}
    <span className="flex-1 truncate font-semibold">{name}</span>
    <span className="font-extrabold tabular-nums">{score.toLocaleString()}</span>
  </div>
);
