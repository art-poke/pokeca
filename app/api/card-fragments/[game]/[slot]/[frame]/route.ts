import { UUID } from "@/lib/uuid";
import { practiceImage } from "@/domains/card-fragments/practice";
import { gamePlayerId } from "@/lib/game-player";
import { isGame, koreaDay, parseRound } from "@/domains/card-fragments/rules";
import { loadImage } from "@/domains/card-fragments/server";

export async function GET(request: Request, { params }: RouteContext<"/api/card-fragments/[game]/[slot]/[frame]">) {
  const { game, slot, frame } = await params;
  const query = new URL(request.url).searchParams;
  const day = query.get("day");
  const practiceId = query.get("practice");
  const stage = parseRound(query.get("stage"));
  if (!isGame(game) || !/^[0-2]$/.test(slot) || !day || !/^\d{4}-\d{2}-\d{2}$/.test(day)
      || (practiceId && !UUID.test(practiceId)) || day > koreaDay() || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day
      || (frame !== "close" && frame !== "wide" && frame !== "reveal")) return new Response(null, { status: 404 });

  const userId = await gamePlayerId();
  if (!userId) return new Response(null, { status: 401 });
  const image = practiceId
    ? await practiceImage(game, day, userId, practiceId, stage, Number(slot), frame)
    : await loadImage(game, day, stage, Number(slot), frame, userId);
  return image ? new Response(new Uint8Array(image), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store" },
  }) : new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
}
