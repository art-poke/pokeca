import { cn } from "@/lib/utils";

// 몬스터볼 심볼 마크 (레드 상단 · 블랙 밴드 · 화이트 버튼).
export const PokeballMark = ({ className }: { className?: string }) => {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("size-7", className)}
      role="img"
      aria-label="몬스터볼"
    >
      <defs>
        <clipPath id="pokeball-clip">
          <circle cx="20" cy="20" r="19" />
        </clipPath>
      </defs>
      <g clipPath="url(#pokeball-clip)">
        <rect x="0" y="0" width="40" height="20" fill="#ee1515" />
        <rect x="0" y="20" width="40" height="20" fill="#ffffff" />
        <rect x="0" y="17.3" width="40" height="5.4" fill="#111113" />
      </g>
      <circle cx="20" cy="20" r="19" fill="none" stroke="#111113" strokeWidth="2.4" />
      <circle cx="20" cy="20" r="6.6" fill="#ffffff" stroke="#111113" strokeWidth="2.6" />
      <circle cx="20" cy="20" r="2.4" fill="#ffffff" stroke="#111113" strokeWidth="1.4" />
    </svg>
  );
};

// 로고 = 몬스터볼 마크 + 워드마크.
export const Logo = ({ className }: { className?: string }) => {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <PokeballMark className="size-7 shrink-0" />
      <span className="font-display text-lg font-bold tracking-tight text-foreground">
        Extended <span className="text-primary">Art</span> Archive
      </span>
    </span>
  );
};
