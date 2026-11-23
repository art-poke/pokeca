import { sql } from "drizzle-orm";
import { db } from "./db";
export async function unavailableMember(id: string) {
  const result =
    await db.execute(sql`select 1 from users u left join artists a on a.user_id=u.id
    where u.id=${id} and (u.suspended_at is not null or a.deleted_at is not null)`);
  return result.rows.length > 0;
}
