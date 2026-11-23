import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { beginOAuth, finishOAuth } from "@/lib/analytics/oauth";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name) } : undefined,
  }),
}));
it("links the verified flow to its source and records signup only once across duplicate callback delivery", async () => {
  const visitor = randomUUID(),
    sid = randomUUID(),
    user = randomUUID();
  jar.set("vid", visitor);
  jar.set("art_session", sid);
  jar.set("authjs.pkce.code_verifier", randomUUID());
  try {
    await db.execute(sql`insert into users(id) values(${user})`);
    await beginOAuth(
      "kakao",
      JSON.stringify({
        page: "game_hub",
        action: "select_game",
        placement: "content",
      }),
    );
    await Promise.all([
      finishOAuth("kakao", user, true),
      finishOAuth("kakao", user, true),
    ]);
    jar.set("authjs.pkce.code_verifier", randomUUID());
    await beginOAuth("google", null);
    await finishOAuth("google", user, false);
    const result = await db.execute(
      sql`select type,payload from events where visitor_id=${visitor} order by id`,
    );
    const signed = result.rows.filter((r) => r.type === "signup_completed");
    expect(signed).toHaveLength(1);
    expect(signed[0].payload).toMatchObject({
      page: "game_hub",
      action: "select_game",
      provider: "kakao",
    });
    expect(
      result.rows.filter((r) => r.type === "login_succeeded"),
    ).toHaveLength(2);
  } finally {
    await db.execute(
      sql`delete from events where visitor_id=${visitor} or member_id=${user}`,
    );
    await db.execute(sql`delete from users where id=${user}`);
  }
});
