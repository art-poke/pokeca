import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { anyMember } from "@/lib/artists";
import { GameBoard } from "@/domains/game/components/game-board";

export const metadata = { title: "몬스터볼 드롭 · Extended Art Archive" };

// 로그인 필수. 비로그인은 로그인 페이지로. dev에서는 OAuth 없이 보도록 데모 회원으로 미리보기
// (/me와 동일 패턴, 프로덕션엔 영향 없음). (matter.js Game은 GameCanvas의 useEffect에서만
// 생성되어 SSR 안전하므로 dynamic ssr:false 없이 클라 컴포넌트를 그대로 렌더한다.)
export default async function PlayPage() {
  const session = await auth();
  let userId = session?.user?.id;
  if (!userId && process.env.NODE_ENV === "development") {
    userId = (await anyMember())?.userId;
  }
  if (!userId) redirect("/artist/login");
  return <GameBoard currentUserId={userId} />;
}
