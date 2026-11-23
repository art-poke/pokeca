import "server-only";
import { sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { isVisitorId } from "@/lib/visitor";

export async function writeEvent(
  type: string,
  member: string | null,
  payload: Record<string, unknown> = {},
  key?: string,
  target: { cardId?: string; artworkId?: string } = {},
) {
  const jar = await cookies();
  const visitor = jar.get("vid")?.value;
  const session = jar.get("art_session")?.value;
  await db.execute(sql`insert into events(type, visitor_id, member_id, session_id, payload, event_key, card_id, artwork_id)
    select ${type}, ${isVisitorId(visitor) ? visitor : null}::uuid, ${member}::uuid,
      ${isVisitorId(session) ? session : null}::uuid, ${JSON.stringify(payload)}::jsonb, ${key ?? null}::uuid,
      ${target.cardId ?? null}::uuid, ${target.artworkId ?? null}::uuid
    where not exists(select 1 from admins where user_id=${member}::uuid)
    on conflict do nothing`);
}

export async function recordActivity(
  type: string,
  member: string | null,
  payload: Record<string, unknown> = {},
) {
  try {
    await writeEvent(type, member, payload);
  } catch {
    console.error("analytics write failed", type);
  }
}
