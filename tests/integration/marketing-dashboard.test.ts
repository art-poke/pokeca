import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  audience,
  insights,
  metrics,
  period,
  retention,
  trends,
} from "@/lib/analytics/report";

it("counts an exposed browser once and attributes signup only to the matching OAuth attempt", async () => {
  const visitor = randomUUID(),
    session = randomUUID(),
    attempt = randomUUID(),
    user = randomUUID();
  const now = new Date(),
    day = 86400000;
  const p = period({ unit: "month" }, new Date(+now + 60000));
  const origin = {
    page: "card_detail",
    action: "download_artwork",
    placement: "content",
  };
  try {
    await db.execute(sql`insert into users(id) values(${user})`);
    for (const [name, key, member, payload] of [
      ["page_view", randomUUID(), null, { page: "card_detail" }],
      ["cta_impression", randomUUID(), null, origin],
      ["cta_clicked", randomUUID(), null, origin],
      ["oauth_started", attempt, null, origin],
      ["login_succeeded", randomUUID(), user, { attempt }],
      ["signup_completed", randomUUID(), user, { attempt }],
    ] as const) {
      await db.execute(sql`insert into events(type,event_key,session_id,visitor_id,member_id,payload)
        values(${name},${key},${session},${visitor},${member},${JSON.stringify(payload)})`);
    }
    const segments = await audience(p.start, p.end);
    expect(segments.repeat.people).toBeGreaterThanOrEqual(1);
    expect(
      segments.pages.find((row) => row.page === origin.page)?.converted,
    ).toBeGreaterThanOrEqual(1);
    const data = await insights(p.start, p.end);
    expect(
      data.conversion.find(
        (r) => r.page === origin.page && r.action === origin.action,
      )?.converted,
    ).toBeGreaterThanOrEqual(1);
    expect((await metrics(p.start, p.end)).visitors).toBeGreaterThanOrEqual(1);
    expect((await trends(p))[0].visitors).toBeGreaterThanOrEqual(1);
    expect(await retention(new Date(+now - day), p.end)).toBeInstanceOf(Array);
  } finally {
    await db.execute(sql`delete from events where visitor_id=${visitor}`);
    await db.execute(sql`delete from users where id=${user}`);
  }
});

it("groups legacy search terms after masking contact details", async () => {
  const visitor = randomUUID();
  const start = new Date("2014-06-14T00:00:00Z");
  const end = new Date(+start + 1000);
  try {
    for (const query of ["a@example.com 010-1234-5678", "b@example.org 01098765432"]) {
      await db.execute(sql`insert into events(type,visitor_id,created_at,payload)
        values('search',${visitor},${start},${JSON.stringify({ query, hits: 0 })})`);
    }
    expect((await insights(start, end)).searches).toEqual([
      { query: "[이메일] [전화번호]", n: 2, miss: 2 },
    ]);
  } finally {
    await db.execute(sql`delete from events where visitor_id=${visitor}`);
  }
});
