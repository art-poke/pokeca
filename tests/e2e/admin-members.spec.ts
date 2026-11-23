import { test, expect } from "@playwright/test";
import {
  ADMIN,
  ensureUser,
  memberSessionCookie,
  sessionCookies,
  sql,
} from "./db";
test.skip(
  ({ isMobile }) => isMobile,
  "membership operations use the same server actions",
);
test("member actions update access for an existing session and record each change", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await ensureUser(ADMIN, true);
  const email = "qa-member-" + crypto.randomUUID() + "@example.com";
  const memberContext = await browser.newContext({ baseURL });
  await memberContext.addCookies([await memberSessionCookie(baseURL!, email)]);
  const [target] = await sql`select id from users where email=${email}`;
  const [actor] = await sql`select id from users where email=${ADMIN.email}`;
  try {
    await sql`insert into artists(user_id,display_name,provider) values(${target.id},'운영 검증 회원','kakao')`;
    await context.addCookies(
      await sessionCookies(ADMIN.email, ADMIN.password, baseURL!),
    );
    await page.goto("/admin/users?id=" + target.id);
    await expect(
      page.getByRole("heading", { name: "회원 상세" }),
    ).toBeVisible();
    await expect(page.getByLabel("변경 사유")).toHaveCount(0);
    await sql`update admins set manage_members=true where user_id=${actor.id}`;
    await page.reload();
    for (const action of ["grant", "revoke", "suspend", "restore"]) {
      await page.getByLabel("계정 조치").selectOption(action);
      await page.getByLabel("변경 사유").fill("기능 검증");
      await page.getByRole("button", { name: "적용" }).click();
      await expect
        .poll(
          async () =>
            (
              await sql`select count(*)::int n from admin_member_audit where action=${action} and target_id=${target.id}`
            )[0].n,
        )
        .toBe(1);
      await expect
        .poll(
          async () =>
            (
              await sql`select suspended_at is not null as suspended from users where id=${target.id}`
            )[0].suspended,
        )
        .toBe(action === "suspend");
      const role =
        await sql`select manage_members,email from admins where user_id=${target.id}`;
      expect(role.length).toBe(action === "grant" ? 1 : 0);
      if (action === "grant") {
        expect(role[0].manage_members).toBe(false);
        expect(role[0].email).toBe("admin:" + target.id);
      }
      const session = await (
        await memberContext.request.get("/api/auth/session")
      ).json();
      expect(session.user.id).toBe(action === "suspend" ? "" : target.id);
      await expect(
        page.getByRole("status").filter({ hasText: "처리했습니다" }),
      ).toBeVisible();
    }
  } finally {
    await memberContext.close();
    await sql`update admins set manage_members=false where user_id=${actor.id}`;
    await sql`delete from admin_member_audit where target_id=${target.id}`;
    await sql`delete from users where id=${target.id}`;
  }
});
