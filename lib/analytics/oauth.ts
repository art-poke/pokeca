import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { actions, pageNames, placements } from "./taxonomy";
import { writeEvent } from "./write";

// Use the per-flow Auth.js cookie available to both the start action and the verified callback.
async function flowKey() {
  const jar = await cookies();
  const cookie = [
    "__Secure-authjs.pkce.code_verifier",
    "authjs.pkce.code_verifier",
    "__Secure-authjs.state",
    "authjs.state",
    "__Secure-authjs.nonce",
    "authjs.nonce",
  ]
    .map((name) => jar.get(name))
    .find((c) => c?.value);
  return cookie
    ? createHash("sha256").update(cookie.value).digest("hex")
    : null;
}
export async function beginOAuth(
  provider: string,
  raw: FormDataEntryValue | null,
) {
  try {
    let origin;
    try {
      origin = JSON.parse(String(raw));
    } catch {}
    const matched =
      origin &&
      pageNames.has(origin.page) &&
      actions.has(origin.action) &&
      placements.has(origin.placement);
    await writeEvent(
      "oauth_started",
      null,
      {
        provider,
        flow: await flowKey(),
        page: matched ? origin.page : "social_login",
        action: matched ? origin.action : "direct_route",
        placement: matched ? origin.placement : "direct",
      },
      crypto.randomUUID(),
    );
  } catch {
    console.error("oauth start measurement failed");
  }
}
export async function finishOAuth(
  provider: string,
  userId: string,
  signup: boolean,
) {
  try {
    const flow = await flowKey();
    const visitor = (await cookies()).get("vid")?.value;
    await db.transaction(async (tx) => {
      const found =
        await tx.execute(sql`select event_key, session_id, visitor_id, payload - 'flow' as origin from events
        where type='oauth_started' and payload->>'provider'=${provider} and payload->>'flow'=${flow}
          and visitor_id::text=${visitor ?? ""} and created_at>now()-interval '1 hour' order by id desc limit 1 for update`);
      const start = found.rows[0];
      const origin = (start?.origin ?? {
        provider,
        page: "unknown",
        action: "unknown",
        placement: "unknown",
      }) as Record<string, unknown>;
      for (const type of signup
        ? ["login_succeeded", "signup_completed"]
        : ["login_succeeded"]) {
        await tx.execute(sql`insert into events(type, member_id, visitor_id,session_id,payload)
          select ${type},${userId}::uuid,${start?.visitor_id ?? null}::uuid,${start?.session_id ?? null}::uuid,
            ${JSON.stringify({ ...origin, attempt: start?.event_key })}::jsonb
          where not exists(select 1 from admins where user_id=${userId}::uuid)
          and not exists(select 1 from events where type=${type} and payload->>'attempt'=${start?.event_key ?? null})
          on conflict do nothing`);
      }
    });
  } catch {
    console.error("oauth outcome measurement failed");
  }
}
