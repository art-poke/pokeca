import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

describe("db smoke", () => {
  it("connects and selects users table", async () => {
    const r = await db.execute(sql`select count(*)::int as n from users`);
    expect(Array.isArray((r as any).rows)).toBe(true);
    expect(typeof (r as any).rows[0].n).toBe("number");
  });
});
