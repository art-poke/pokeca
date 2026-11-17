import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GameBoard } from "@/domains/game/components/game-board";

export const metadata = { title: "몬스터볼 드롭 · Extended Art Archive" };

// 로그인 필수. 점수가 계정에 기록되므로 비로그인은 로그인 페이지로 보낸다(환경 무관).
// (matter.js Game은 GameCanvas의 useEffect에서만 생성되어 SSR 안전하므로 dynamic ssr:false 없이
// 클라 컴포넌트를 그대로 렌더한다.)
export default async function PlayPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/artist/login");
  return <GameBoard currentUserId={userId} />;
}
