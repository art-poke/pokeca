"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { UUID } from "@/lib/uuid";

const commands = new Set(["grant", "revoke", "suspend", "restore"]);
export async function changeMember(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id"));
  const action = String(form.get("action"));
  const reason = String(form.get("reason") ?? "").trim();
  if (
    !UUID.test(id) ||
    !commands.has(action) ||
    !reason ||
    reason.length > 300 ||
    id === admin.userId
  )
    redirect("/admin/users?error=invalid");
  const result = await db.transaction(async (tx) => {
    // Role changes and suspensions share one lock, including concurrent changes to the actor.
    await tx.execute(sql`select pg_advisory_xact_lock(74201923)`);
    const permission =
      await tx.execute(sql`select 1 from admins d join users u on u.id=d.user_id
      where user_id=${admin.userId} and manage_members and u.suspended_at is null`);
    if (!permission.rows.length) return "forbidden";
    const target =
      await tx.execute(sql`select u.email,u.suspended_at,d.user_id admin,d.manage_members
      from users u left join artists a on a.user_id=u.id left join admins d on d.user_id=u.id
      where u.id=${id} and a.deleted_at is null and
        (a.provider in ('google','kakao') or exists(select 1 from accounts ac where ac."userId"=u.id and ac.provider in ('google','kakao')))
      for update of u`);
    const row = target.rows[0];
    if (!row) return "missing";
    if (row.manage_members && (action === "suspend" || action === "revoke")) {
      const other =
        await tx.execute(sql`select 1 from admins d join users u on u.id=d.user_id where d.manage_members
        and d.user_id<>${id} and u.suspended_at is null limit 1`);
      if (!other.rows.length) return "last";
    }
    if (action === "grant" && row.suspended_at) return "suspended";
    if (
      (action === "grant" && row.admin) ||
      (action === "revoke" && !row.admin) ||
      (action === "suspend" && row.suspended_at) ||
      (action === "restore" && !row.suspended_at)
    )
      return "ok";
    if (action === "grant")
      await tx.execute(
        sql`insert into admins(user_id,email) values(${id},${row.email ?? "admin:" + id})`,
      );
    if (action === "revoke")
      await tx.execute(sql`delete from admins where user_id=${id}`);
    if (action === "suspend")
      await tx.execute(sql`update users set suspended_at=now() where id=${id}`);
    if (action === "restore")
      await tx.execute(sql`update users set suspended_at=null where id=${id}`);
    await tx.execute(sql`insert into admin_member_audit(actor_id,target_id,action,reason)
      values(${admin.userId},${id},${action},${reason})`);
    return "ok";
  });
  revalidatePath("/admin/users");
  redirect(
    "/admin/users?id=" +
      id +
      (result === "ok" ? "&saved=1" : "&error=" + result),
  );
}
