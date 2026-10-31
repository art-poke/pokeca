import Link from "next/link";
import { BOARD_LABEL, BOARDS, type Board } from "@/lib/community";
import { cn } from "@/lib/utils";

// 커뮤니티 카테고리 탭: 자유게시판·건의사항·공지사항 + 작가 후기. 두 페이지에서 공유.
const tab = "rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors";
const activeCls = "bg-background text-foreground shadow-xs";
const idleCls = "text-muted-foreground hover:text-foreground";

export function CommunityTabs({ active }: { active: Board | "reviews" }) {
  return (
    <div className="inline-flex flex-wrap rounded-xl bg-muted p-1">
      {BOARDS.map((b) => (
        <Link
          key={b}
          href={`/community?board=${b}`}
          aria-current={active === b}
          className={cn(tab, active === b ? activeCls : idleCls)}
        >
          {BOARD_LABEL[b]}
        </Link>
      ))}
      <Link
        href="/community/reviews"
        aria-current={active === "reviews"}
        className={cn(tab, active === "reviews" ? activeCls : idleCls)}
      >
        작가 후기
      </Link>
    </div>
  );
}
