import { redirect } from "next/navigation";
import { gamePlayerId } from "@/lib/game-player";
import { GameBoard } from "@/domains/game/components/game-board";

export const metadata = { title: "몬스터볼 드롭 · Extended Art Archive" };

// 점수 저장에는 로그인 계정 또는 로컬 체험 계정이 필요하다.
// (matter.js Game은 GameCanvas의 useEffect에서만 생성되어 SSR 안전하므로 dynamic ssr:false 없이
// 클라 컴포넌트를 그대로 렌더한다.)
export default async function PlayPage() {
  const userId = await gamePlayerId();
  if (!userId) redirect("/artist/login?source=game_play");
  return <GameBoard currentUserId={userId} />;
}
