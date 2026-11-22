import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { visitorId } from "@/lib/visitor";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isLoopback(host: string | null) {
  return !!host && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
}

export async function gamePlayerId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  const secret = process.env.AUTH_SECRET;
  const databaseUrl = process.env.DATABASE_URL;
  if (!secret || !databaseUrl || (process.env.NODE_ENV !== "development" && process.env.LOCAL_GAME_PREVIEW !== "1")) return null;
  if (!loopbackHosts.has(new URL(databaseUrl).hostname)) return null;

  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  if (!isLoopback(requestHeaders.get("host")) || (forwardedHost && !isLoopback(forwardedHost))) return null;

  const visitor = await visitorId();
  if (!visitor) return null;
  const hash = createHmac("sha256", secret).update("local-game-player:" + visitor).digest("hex");
  const id = [hash.slice(0, 8), hash.slice(8, 12), "4" + hash.slice(13, 16), "8" + hash.slice(17, 20), hash.slice(20, 32)].join("-");
  await db.insert(users).values({ id, name: "로컬 게임 체험" }).onConflictDoNothing({ target: users.id });
  return id;
}
