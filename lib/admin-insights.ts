import "server-only";
import { count, countDistinct, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  artistReviews,
  artworks,
  comments,
  events,
  gameScores,
  posts,
  reports,
  requests,
  users,
} from "@/lib/db/schema";
import { listAdminArtworks } from "@/lib/admin-data";

// 어드민 행동/현황 집계 (설계 Phase 1). 전부 익명(vid) 기준, PII 없음.
// 기간은 KST(Asia/Seoul) 기준. created_at >= (KST 경계의 UTC instant) 로 필터해 events 인덱스를 탄다 (eng review).

export type Range = "today" | "7d" | "30d";
export const RANGES: Range[] = ["today", "7d", "30d"];
export const RANGE_LABEL: Record<Range, string> = { today: "오늘", "7d": "최근 7일", "30d": "최근 30일" };

export function toRange(value: string | undefined): Range {
  return value === "today" || value === "30d" ? value : "7d";
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// KST(DST 없음) 기준 기간 시작의 UTC instant. today=KST 오늘 0시, 7d=6일 전, 30d=29일 전.
export function rangeStartUtc(range: Range, now: Date): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const kstMidnight = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
  const days = range === "30d" ? 29 : range === "7d" ? 6 : 0;
  return new Date(kstMidnight - days * 86_400_000 - KST_OFFSET_MS);
}

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);

// 방문자 ----------------------------------------------------------------------
export type VisitorStats = {
  unique: number;
  returning: number;
  newVisitors: number;
  daily: { day: string; visitors: number }[];
};

export async function visitorStats(start: Date): Promise<VisitorStats> {
  const uniqRows = await db
    .select({ n: countDistinct(events.visitorId) })
    .from(events)
    .where(gte(events.createdAt, start));
  const unique = num(uniqRows[0]?.n);

  const ret = await db.execute(sql`
    select count(distinct e.visitor_id)::int as n
    from ${events} e
    where e.visitor_id is not null and e.created_at >= ${start}
      and exists (select 1 from ${events} p where p.visitor_id = e.visitor_id and p.created_at < ${start})
  `);
  const returning = num((ret.rows[0] as Row)?.n);

  const daily = await db.execute(sql`
    select to_char((e.created_at at time zone 'Asia/Seoul')::date, 'YYYY-MM-DD') as day,
           count(distinct e.visitor_id)::int as visitors
    from ${events} e
    where e.visitor_id is not null and e.created_at >= ${start}
    group by day order by day
  `);

  return {
    unique,
    returning,
    newVisitors: Math.max(0, unique - returning),
    daily: daily.rows.map((r: Row) => ({ day: String(r.day), visitors: num(r.visitors) })),
  };
}

// 체류 TOP 페이지 ------------------------------------------------------------
export type PageRow = { path: string; views: number; avgDwellMs: number };

export async function topPages(start: Date, limit = 12): Promise<PageRow[]> {
  const rows = await db.execute(sql`
    select coalesce(v.path, l.path) as path,
           coalesce(v.views, 0)::int as views,
           coalesce(l.avg_dwell, 0)::int as avg_dwell_ms
    from (
      select payload->>'path' as path, count(*) as views
      from ${events}
      where type = 'page_view' and created_at >= ${start} and payload->>'path' is not null
      group by payload->>'path'
    ) v
    full outer join (
      select payload->>'path' as path, avg((payload->>'dwell_ms')::numeric) as avg_dwell
      from ${events}
      where type = 'page_leave' and created_at >= ${start} and payload->>'path' is not null
      group by payload->>'path'
    ) l on v.path = l.path
    order by views desc, avg_dwell_ms desc
    limit ${limit}
  `);
  return rows.rows.map((r: Row) => ({ path: String(r.path), views: num(r.views), avgDwellMs: num(r.avg_dwell_ms) }));
}

// 클릭 히트 ------------------------------------------------------------------
export type ClickRow = { label: string; count: number };

export async function topClicks(start: Date, limit = 12): Promise<ClickRow[]> {
  const rows = await db.execute(sql`
    select payload->>'label' as label, count(*)::int as n
    from ${events}
    where type = 'click' and created_at >= ${start} and payload->>'label' is not null
    group by payload->>'label' order by n desc limit ${limit}
  `);
  return rows.rows.map((r: Row) => ({ label: String(r.label), count: num(r.n) }));
}

// 검색어 TOP (성공 + 실패) ---------------------------------------------------
export type SearchRow = { query: string; count: number };
export type SearchStats = { success: SearchRow[]; misses: SearchRow[] };

export async function topSearches(start: Date, limit = 12): Promise<SearchStats> {
  const [success, misses] = await Promise.all([
    db.execute(sql`
      select payload->>'query' as query, count(*)::int as n
      from ${events}
      where type = 'search' and created_at >= ${start}
        and payload->>'query' is not null and coalesce((payload->>'hits')::int, 0) > 0
      group by payload->>'query' order by n desc limit ${limit}
    `),
    db.execute(sql`
      select query, count(*)::int as n
      from ${sql.raw("search_misses")}
      where created_at >= ${start}
      group by query order by n desc limit ${limit}
    `),
  ]);
  return {
    success: success.rows.map((r: Row) => ({ query: String(r.query), count: num(r.n) })),
    misses: misses.rows.map((r: Row) => ({ query: String(r.query), count: num(r.n) })),
  };
}

// 퍼널: 검색 → 카드상세 열람 → 원본 클릭 (방문자 수 기준) ----------------------
export type Funnel = {
  searchers: number;
  cardViewers: number;
  sourceClickers: number;
  searchToCard: number; // %
  cardToSource: number; // %
};

async function distinctVisitors(whereSql: ReturnType<typeof sql>): Promise<number> {
  const r = await db.execute(sql`
    select count(distinct visitor_id)::int as n from ${events}
    where visitor_id is not null and ${whereSql}
  `);
  return num((r.rows[0] as Row)?.n);
}

export async function funnel(start: Date): Promise<Funnel> {
  const [searchers, cardViewers, sourceClickers] = await Promise.all([
    distinctVisitors(sql`type = 'search' and created_at >= ${start}`),
    distinctVisitors(sql`type = 'page_view' and created_at >= ${start} and payload->>'path' like '/cards/%'`),
    distinctVisitors(sql`type = 'source_click' and created_at >= ${start}`),
  ]);
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  return {
    searchers,
    cardViewers,
    sourceClickers,
    searchToCard: pct(cardViewers, searchers),
    cardToSource: pct(sourceClickers, cardViewers),
  };
}

// 인기 콘텐츠: 기간 내 원본 클릭 TOP 작품 (artwork_id FK 기준). ------------------
export type ContentRow = { artworkId: string; label: string; artistName: string; clicks: number };

export async function topContent(start: Date, limit = 12): Promise<ContentRow[]> {
  const rows = await db.execute(sql`
    select a.id as artwork_id, c.set_code, c.collector_number, a.artist_name, count(*)::int as clicks
    from ${events} e
    join ${artworks} a on a.id = e.artwork_id
    join ${sql.raw("cards")} c on c.id = a.card_id
    where e.type = 'source_click' and e.created_at >= ${start}
    group by a.id, c.set_code, c.collector_number, a.artist_name
    order by clicks desc limit ${limit}
  `);
  return rows.rows.map((r: Row) => ({
    artworkId: String(r.artwork_id),
    label: `${String(r.set_code)} ${String(r.collector_number)}`,
    artistName: String(r.artist_name),
    clicks: num(r.clicks),
  }));
}

// 현황 대시보드 (/admin 랜딩) ------------------------------------------------
export type WindowCounts = {
  members: number;
  artworks: number;
  posts: number;
  comments: number;
  reviews: number;
  gamePlays: number;
  visitors: number;
};
export type DashboardSummary = {
  today: WindowCounts;
  week: WindowCounts;
  alerts: { openReports: number; needsCheckArtworks: number; pendingRequests: number };
};

async function windowCounts(start: Date): Promise<WindowCounts> {
  const [m, a, p, c, r, g, v] = await Promise.all([
    db.select({ n: count() }).from(users).where(gte(users.createdAt, start)),
    db.select({ n: count() }).from(artworks).where(gte(artworks.createdAt, start)),
    db.select({ n: count() }).from(posts).where(sql`${posts.createdAt} >= ${start} and ${posts.deletedAt} is null`),
    db.select({ n: count() }).from(comments).where(sql`${comments.createdAt} >= ${start} and ${comments.deletedAt} is null`),
    db.select({ n: count() }).from(artistReviews).where(sql`${artistReviews.createdAt} >= ${start} and ${artistReviews.deletedAt} is null`),
    db.select({ n: count() }).from(gameScores).where(gte(gameScores.createdAt, start)),
    db.select({ n: countDistinct(events.visitorId) }).from(events).where(gte(events.createdAt, start)),
  ]);
  return {
    members: num(m[0]?.n),
    artworks: num(a[0]?.n),
    posts: num(p[0]?.n),
    comments: num(c[0]?.n),
    reviews: num(r[0]?.n),
    gamePlays: num(g[0]?.n),
    visitors: num(v[0]?.n),
  };
}

export async function dashboardSummary(now = new Date()): Promise<DashboardSummary> {
  const [today, week, openReports, needsCheck, pendingRequests] = await Promise.all([
    windowCounts(rangeStartUtc("today", now)),
    windowCounts(rangeStartUtc("7d", now)),
    db.select({ n: count() }).from(reports).where(sql`${reports.status} = 'open'`),
    listAdminArtworks({ needsCheck: true }).then((rows) => rows.length),
    db.select({ n: count() }).from(requests).where(isNull(requests.resolvedAt)),
  ]);
  return {
    today,
    week,
    alerts: {
      openReports: num(openReports[0]?.n),
      needsCheckArtworks: needsCheck,
      pendingRequests: num(pendingRequests[0]?.n),
    },
  };
}
