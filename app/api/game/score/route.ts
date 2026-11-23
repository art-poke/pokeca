import { recordActivity } from "@/lib/analytics/write";
import { gamePlayerId } from "@/lib/game-player";
import { validateScoreSubmission } from "@/domains/game/validation";
import {
  countRecentSubmissions,
  getLeaderboard,
  insertGameScore,
  type LeaderboardScope,
  type ScoreInput,
} from "@/lib/game";

// 로그인 유저당 빈도 제한: 1시간에 20회.
const THROTTLE_WINDOW_MS = 3_600_000;
const THROTTLE_MAX = 20;

// 점수 제출은 플레이어 확인, 검증, 빈도 제한을 거쳐 저장한다.
export async function POST(request: Request) {
  const userId = await gamePlayerId();
  if (!userId) return Response.json({ code: "unauthorized" }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ code: "validation" }, { status: 400 });
  }

  const result = validateScoreSubmission(payload);
  if (!result.ok) {
    return Response.json({ code: "validation", reason: result.reason }, { status: 400 });
  }

  const recent = await countRecentSubmissions(userId, THROTTLE_WINDOW_MS);
  if (recent >= THROTTLE_MAX) {
    return Response.json({ code: "rate_limited" }, { status: 429 });
  }

  const id = await insertGameScore(userId, payload as ScoreInput);
  await recordActivity("game_score_saved",userId,{id});
  return Response.json({ id }, { status: 201 });
}

// 리더보드 조회. scope=all(역대) | month(월별). 로그인 시 내 순위도 함께.
export async function GET(request: Request) {
  const scopeParam = new URL(request.url).searchParams.get("scope");
  const scope: LeaderboardScope = scopeParam === "month" ? "month" : "all";
  const userId = await gamePlayerId();
  const data = await getLeaderboard(scope, { userId });
  return Response.json(data);
}
