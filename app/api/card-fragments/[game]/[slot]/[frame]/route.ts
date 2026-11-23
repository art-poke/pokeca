import { UUID } from "@/lib/uuid";
import { runImage } from "@/domains/card-fragments/run";
import { gamePlayerId } from "@/lib/game-player";
import { isGame, parseRound } from "@/domains/card-fragments/rules";

export async function GET(request: Request, { params }: RouteContext<"/api/card-fragments/[game]/[slot]/[frame]">) {
  const { game, slot, frame } = await params;
  const query = new URL(request.url).searchParams;
  const runId = query.get("run");
  const stage = parseRound(query.get("stage"));
  if (!isGame(game) || !/^[0-2]$/.test(slot) || !runId || !UUID.test(runId)
      || (frame !== "close" && frame !== "wide" && frame !== "reveal")) return new Response(null, { status: 404 });

  const userId = await gamePlayerId();
  if (!userId) return new Response(null, { status: 401 });
  const image = await runImage(game, userId, runId, stage, Number(slot), frame);
  return image ? new Response(new Uint8Array(image), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store" },
  }) : new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
}
