import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { listAdminArtworks, closeReport, findArtworksBySource, linkReport, setLinkStatus } from "@/lib/admin-data";
import { createArtwork } from "@/lib/artworks";
import { hashRange, ReportError, submitReport } from "@/lib/reports";
import { createRequest, requestState } from "@/lib/requests";
import { cardId, PDF, PNG, resetArtworks, sql, uploadAsBrowser } from "../helpers/fixtures";

// @/lib/artworks가 Drizzle(@/lib/db)로 전환됐다. 스토리지·시드 카드는 아직 Supabase(sub D)이므로
// 둘이 같은 Postgres를 보도록, @/lib/db가 Pool을 만들기 전에 DATABASE_URL을 Supabase DB로 맞춘다(hoisted).
vi.hoisted(() => {
  if (process.env.SUPABASE_DB_URL) process.env.DATABASE_URL = process.env.SUPABASE_DB_URL;
});

afterAll(() => sql.end());
beforeEach(resetArtworks);

async function stored(sourceUrl = "https://cafe.naver.com/pokeca/123") {
  const id = crypto.randomUUID();
  await createArtwork(
    {
      id, cardId: await cardId(), artistName: "신고대상", format: "9pocket", sourceUrl, sourceVisibility: "public",
      printSizeVerified: false,
    },
    {
      original: await uploadAsBrowser("original", PDF, "application/pdf"),
      thumbnail: await uploadAsBrowser("thumbnail", PNG, "image/png"),
    },
    "test",
  );
  return id;
}

const report = (artworkId: string | null, sourceUrl: string | null = null) => ({
  artworkId, sourceUrl, reason: "rights_holder" as const, contact: null, message: null,
});

describe("reports (설계 신고 흐름)", () => {
  it("auto-hides after reports from 3 different ranges, not from one range", async () => {
    const id = await stored();
    const sameRange = hashRange("203.0.113.1", "t");
    await submitReport(report(id), sameRange);
    await submitReport(report(id), hashRange("203.0.113.9", "t"));
    await submitReport(report(id), sameRange);
    let [row] = await sql`select status from artworks where id = ${id}`;
    expect(row.status).toBe("active");

    await submitReport(report(id), hashRange("198.51.100.1", "t"));
    const third = await submitReport(report(id), hashRange("192.0.2.1", "t"));
    expect(third.autoHidden).toBe(true);
    [row] = await sql`select status from artworks where id = ${id}`;
    expect(row.status).toBe("hidden");
    const [event] = await sql`select actor from consent_events where artwork_id = ${id} and kind = 'status'`;
    expect(event.actor).toBe("system:reports");
    // reports에는 IP를 남기지 않는다.
    const columns = await sql`select column_name from information_schema.columns where table_name = 'reports'`;
    expect(columns.map((c) => c.column_name)).not.toContain("ip_hash");
  });

  it("limits each range to 5 reports a day", async () => {
    const hash = hashRange("203.0.113.1", "t");
    for (let i = 0; i < 5; i++) await submitReport(report(null, `https://example.com/${i}`), hash);
    await expect(submitReport(report(null, "https://example.com/6"), hash)).rejects.toSatisfy(
      (e) => e instanceof ReportError && e.code === "rate_limited",
    );
    const [{ count }] = await sql<{ count: number }[]>`select count(*)::int from reports`;
    expect(count).toBe(5);
  });

  it("keeps the daily limit under concurrent reports from one range", async () => {
    const hash = hashRange("198.51.100.1", "t");
    await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => submitReport(report(null, `https://example.com/c${i}`), hash)),
    );
    const [{ count }] = await sql<{ count: number }[]>`select count(*)::int from reports`;
    expect(count).toBe(5);
  });

  it("links a URL-only report to the artwork it names and closes it (eng E7)", async () => {
    const id = await stored("https://cafe.naver.com/pokeca/123");
    const { id: reportId } = await submitReport(report(null, "https://cafe.naver.com/pokeca/123?art=1"), "h");
    const candidates = await findArtworksBySource("https://cafe.naver.com/pokeca/123?art=1");
    expect(candidates.map((c) => c.id)).toEqual([id]);

    await linkReport(reportId, id);
    await closeReport(reportId, "resolved", "숨김 처리");
    const [row] = await sql`select artwork_id, status, resolution_note, resolved_at from reports where id = ${reportId}`;
    expect(row).toMatchObject({ artwork_id: id, status: "resolved", resolution_note: "숨김 처리" });
    expect(row.resolved_at).not.toBeNull();
    // 닫힌 신고는 다시 닫을 수 없다.
    await expect(closeReport(reportId, "no_target", "")).rejects.toThrow();
  });
});

describe("find requests (design 5A, eng E5)", () => {
  it("counts a visitor once per card and format and hides the waiting count below 3", async () => {
    const card = await cardId();
    const me = crypto.randomUUID();
    await createRequest(card, "brg", me);
    await createRequest(card, "brg", me);
    let state = await requestState(card, me);
    expect(state.brg).toEqual({ requested: true, waiting: null });
    expect(state.psa).toEqual({ requested: false, waiting: null });

    await createRequest(card, "brg", crypto.randomUUID());
    await createRequest(card, "brg", crypto.randomUUID());
    state = await requestState(card, null);
    expect(state.brg).toEqual({ requested: false, waiting: 3 });
    const [{ count }] = await sql<{ count: number }[]>`select count(*)::int from events where type = 'request'`;
    expect(count).toBe(3);
  });
});

describe("manual link checks (eng E6)", () => {
  it("records the result and drops the artwork from the needs-check filter", async () => {
    const id = await stored();
    expect((await listAdminArtworks({ needsCheck: true })).map((r) => r.id)).toEqual([id]);

    await setLinkStatus(id, "deleted");
    const [row] = await sql`select link_status, link_checked_at from artworks where id = ${id}`;
    expect(row.link_status).toBe("deleted");
    expect(await listAdminArtworks({ needsCheck: true })).toEqual([]);

    const eightDaysLater = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    expect((await listAdminArtworks({ needsCheck: true }, eightDaysLater)).map((r) => r.id)).toEqual([id]);
  });
});
