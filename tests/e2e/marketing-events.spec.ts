import { expect, test } from "@playwright/test";
import { sql } from "./db";

// The public collector ignores automation user agents. Exercise a normal visitor session.
test.use({ userAgent: "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36" });

test("a guest game visit carries its page and button into the social login form", async ({
  page,
  context,
}) => {
  await page.goto("/games?utm_source=qa");
  const visitor = (await context.cookies()).find(
    (cookie) => cookie.name === "vid",
  )!.value;
  try {
    const game = page.locator('[data-track="select_game"]').first();
    await game.scrollIntoViewIfNeeded();
    await expect
      .poll(
        async () =>
          (
            await sql`
      select count(*)::int n from events where visitor_id=${visitor} and type='cta_impression'
        and payload->>'action'='select_game'`
          )[0].n,
      )
      .toBeGreaterThan(0);
    await game.click();
    await expect(page.locator('input[name="origin"]')).toHaveValue(
      /"page":"game_hub","action":"select_game"/,
    );
    await expect
      .poll(
        async () =>
          (
            await sql`
      select count(distinct type)::int n from events where visitor_id=${visitor}
        and session_id is not null and payload->>'page'='game_hub' and
        ((type='page_view' and payload->>'source'='qa') or (type='cta_clicked' and payload->>'action'='select_game'))`
          )[0].n,
      )
      .toBe(2);
  } finally {
    await sql`delete from events where visitor_id=${visitor}`;
  }
});
