import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type Filters = Record<string, string | string[] | undefined>;
const day = 86400000;
export const dateLabel = (d: Date) =>
  new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10);
const midnight = (d: string) => new Date(d + "T00:00:00+09:00");
function dateParam(s: unknown) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = midnight(s);
  return Number.isFinite(+d) && dateLabel(d) === s ? d : null;
}
export function period(q: Filters, now = new Date()) {
  const today = midnight(dateLabel(now));
  const last =
    q.range === "yesterday" ? new Date(+today - day) : dateParam(q.to);
  const end = new Date(Math.min(+now, last ? +last + day : +now));
  const first =
    q.range === "month"
      ? midnight(dateLabel(today).slice(0, 7) + "-01")
      : dateParam(q.from);
  const start =
    first && +first < +end
      ? new Date(Math.max(+first, +end - 366 * day))
      : new Date(
          +midnight(dateLabel(new Date(+end - 1))) -
            (q.range === "30d"
              ? 29
              : q.range === "7d" || (!q.range && !q.from && !q.to)
                ? 6
                : 0) *
              day,
        );
  const calendarDays =
    Math.round((+midnight(dateLabel(new Date(+end - 1))) - +start) / day) + 1;
  let previousStart = new Date(+start - calendarDays * day);
  let previousEnd = new Date(+end - calendarDays * day);
  if (
    q.range === "month" &&
    dateLabel(start).slice(0, 7) === dateLabel(now).slice(0, 7) &&
    +end === +now
  ) {
    previousStart = midnight(
      dateLabel(new Date(+start - day)).slice(0, 7) + "-01",
    );
    previousEnd = new Date(Math.min(+start, +previousStart + (+end - +start)));
  }
  return {
    start,
    end,
    today,
    now,
    previousStart,
    previousEnd,
    unit: q.unit === "month" ? "month" : "day",
  };
}
export const members = sql`select u.id,u.created_at,a.deleted_at from users u left join artists a on a.user_id=u.id
  where a.provider in ('google','kakao') or exists(select 1 from accounts ac where ac."userId"=u.id and ac.provider in ('google','kakao'))`;
const active = sql`(type in ('search','source_click','download','request','request_created','favorite_added','artwork_published',
  'artwork_recommended','game_started','game_finished','game_score_saved','story_read','story_liked','post_published','comment_created','review_created')
  or (type='cta_clicked' and payload->>'action'='select_ranked_item'))`;
export type Metric = {
  visitors: number;
  active: number;
  logged: number;
  joined: number;
  left_count: number;
  total: number;
  covered: boolean;
};
export async function metrics(start: Date, end: Date): Promise<Metric> {
  const r = await db.execute<Metric>(sql`with m as (${members})
    select count(distinct visitor_id) filter(where type='page_view')::int visitors,
    count(distinct visitor_id) filter(where ${active})::int active,
    count(distinct member_id) filter(where ${active})::int logged,
    (select count(*)::int from m where created_at>=${start} and created_at<${end}) joined,
    (select count(*)::int from m where deleted_at>=${start} and deleted_at<${end}) left_count,
    (select count(*)::int from m where created_at<${end} and (deleted_at is null or deleted_at>=${end})) total,
    (select started_at<${end} from analytics_start limit 1) covered
    from events where created_at>=${start} and created_at<${end}`);
  return r.rows[0];
}
function socialMembers(provider: string) {
  if (!provider) return members;
  return sql`select m.* from (${members}) m where exists(select 1 from artists a where a.user_id=m.id and a.provider=${provider})
    or exists(select 1 from accounts a where a."userId"=m.id and a.provider=${provider})`;
}
export async function trends(p: ReturnType<typeof period>, provider = "") {
  return (
    await db.execute<{
      label: string;
      visitors: number;
      active: number;
      joined: number;
      lost: number;
      total: number;
      covered: boolean;
    }>(sql`
    with m as (${socialMembers(provider)}), buckets as (
      select greatest(b at time zone 'Asia/Seoul',${p.start}::timestamptz) lo,
      least((b+case when ${p.unit}='month' then interval '1 month' else interval '1 day' end) at time zone 'Asia/Seoul',${p.end}::timestamptz) hi,
      to_char(b,case when ${p.unit}='month' then 'YYYY-MM' else 'YYYY-MM-DD' end) label
      from generate_series(date_trunc(${p.unit},${p.start}::timestamptz at time zone 'Asia/Seoul'),
        (${p.end}::timestamptz-interval '1 microsecond') at time zone 'Asia/Seoul',
        case when ${p.unit}='month' then interval '1 month' else interval '1 day' end) b)
    select label, count(distinct visitor_id) filter(where type='page_view')::int visitors,
      count(distinct visitor_id) filter(where ${active})::int active,
      (select count(*)::int from m where created_at>=lo and created_at<hi) joined,
      (select count(*)::int from m where deleted_at>=lo and deleted_at<hi) lost,
      (select count(*)::int from m where created_at<hi and (deleted_at is null or deleted_at>=hi)) total,
      (select started_at<hi from analytics_start limit 1) covered
    from buckets left join events on created_at>=lo and created_at<hi group by label,lo,hi order by lo desc`)
  ).rows;
}
export async function retention(start: Date, end: Date, provider = "") {
  return (
    await db.execute<{
      cohort: string;
      n: number;
      d1: number;
      d7: number;
      d30: number;
    }>(sql`
    with m as (${socialMembers(provider)}), cohort as (
      select id,(created_at at time zone 'Asia/Seoul')::date joined from m
      where created_at>=greatest(${start},(select min(started_at) from analytics_start)) and created_at<${end}),
    days as (select distinct c.id, (e.created_at at time zone 'Asia/Seoul')::date - c.joined as n
      from cohort c join events e on c.id=e.member_id where ${active})
    select c.joined::text cohort,count(distinct c.id)::int n,
    count(distinct c.id) filter(where days.n=1)::int d1,count(distinct c.id) filter(where days.n=7)::int d7,
    count(distinct c.id) filter(where days.n=30)::int d30 from cohort c left join days on c.id=days.id group by c.joined order by c.joined desc`)
  ).rows;
}
export async function insights(start: Date, end: Date) {
  const window = sql`created_at>=${start} and created_at<${end}`;
  const [traffic, searches, conversion, outcomes, channels] = await Promise.all(
    [
      db.execute<{
        page: string;
        views: number;
        people: number;
      }>(sql`select payload->>'page' page,count(*)::int views,count(distinct visitor_id)::int people
      from events where ${window} and type='page_view' and payload ? 'page' group by 1 order by views desc`),
      db.execute<{
        query: string;
        n: number;
        miss: number;
      }>(sql`select payload->>'query' query,count(*)::int n,
      count(*) filter(where payload->>'hits'='0')::int miss from events where ${window} and type='search' group by 1 order by n desc limit 20`),
      db.execute<{
        page: string;
        action: string;
        place: string;
        shown: number;
        clicked: number;
        starts: number;
        ok: number;
        joins: number;
        converted: number;
      }>(sql`
      with base as (select *,coalesce(payload->>'placement','direct') place from events where ${window}
        and type in ('cta_impression','cta_clicked','oauth_started') and member_id is null),
      counts as (select b.payload->>'page' page,b.payload->>'action' action,b.place,
        count(distinct (b.visitor_id,b.session_id)) filter(where b.type='cta_impression')::int shown,
        count(distinct (b.visitor_id,b.session_id)) filter(where b.type='cta_clicked')::int clicked,
        count(distinct b.event_key) filter(where b.type='oauth_started')::int starts,
        count(distinct b.event_key) filter(where f.type='login_succeeded')::int ok,
        count(distinct f.member_id) filter(where f.type='signup_completed')::int joins,
        count(distinct (b.visitor_id,b.session_id)) filter(where f.type='signup_completed' and exists(
          select 1 from base i where i.type='cta_impression' and i.visitor_id=b.visitor_id and i.session_id=b.session_id
            and i.place=b.place and i.payload->>'page'=b.payload->>'page' and i.payload->>'action'=b.payload->>'action' and i.created_at<=b.created_at))::int converted
        from base b left join events f on b.type='oauth_started' and f.payload->>'attempt'=b.event_key::text
          and f.type in ('login_succeeded','signup_completed') and f.created_at>=b.created_at
        group by 1,2,3) select * from counts order by joins desc, starts desc, shown desc limit 100`),
      db.execute<{ type: string; n: number }>(
        sql`select case when type='cta_clicked' then payload->>'action' else type end as type,
          count(*)::int n from events where ${window} and ${active} group by 1 order by n desc`,
      ),
      db.execute<{
        channel: string;
        n: number;
      }>(sql`select coalesce(nullif(payload->>'source',''),nullif(payload->>'ref',''),'직접 유입') channel,
      count(distinct (visitor_id,session_id))::int n from events where ${window} and payload->>'landing'='yes' group by 1 order by n desc`),
    ],
  );
  return {
    traffic: traffic.rows,
    searches: searches.rows,
    conversion: conversion.rows,
    outcomes: outcomes.rows,
    channels: channels.rows,
  };
}

export async function serviceMetrics(start: Date, end: Date) {
  const [providers, requests, funnel, games] = await Promise.all([
    db.execute<{
      provider: string;
      starts: number;
      success: number;
      signups: number;
    }>(sql`
      select s.payload->>'provider' provider,count(distinct s.event_key)::int starts,
      count(distinct s.event_key) filter(where o.type='login_succeeded')::int success,
      count(distinct o.member_id) filter(where o.type='signup_completed')::int signups
      from events s left join events o on o.payload->>'attempt'=s.event_key::text and o.type in ('login_succeeded','signup_completed')
      where s.type='oauth_started' and s.created_at>=${start} and s.created_at<${end} group by 1`),
    db.execute<{
      created: number;
      resolved: number;
      pending: number;
    }>(sql`select
      count(*) filter(where created_at>=${start})::int created,
      count(*) filter(where resolved_at>=${start} and resolved_at<${end})::int resolved,
      count(*) filter(where resolved_at is null or resolved_at>=${end})::int pending from requests where created_at<${end}`),
    db.execute<{ searched: number; viewed: number; downloaded: number }>(sql`
      with search as (select visitor_id,session_id,min(created_at) t from events where type='search'
        and created_at>=${start} and created_at<${end} and session_id is not null and visitor_id is not null group by 1,2),
      steps as (select s.*,v.t view_time from search s left join lateral (select min(created_at) t from events
        where visitor_id=s.visitor_id and session_id=s.session_id and type='page_view' and payload->>'page'='card_detail'
        and created_at>=s.t and created_at<${end}) v on true)
      select count(*)::int searched,count(view_time)::int viewed,count(*) filter(where exists(select 1 from events e
        where e.visitor_id=s.visitor_id and e.session_id=s.session_id and e.type='download' and e.created_at>=s.view_time and e.created_at<${end}))::int downloaded from steps s`),
    db.execute<{
      game: string;
      started: number;
      finished: number;
    }>(sql`with rounds as (
      select distinct visitor_id,payload->>'game' game,payload->>'round' round,min(created_at) t from events
      where type='game_started' and created_at>=${start} and created_at<${end} group by 1,2,3)
      select game,count(*)::int started,count(*) filter(where exists(select 1 from events e where type='game_finished'
        and e.visitor_id=r.visitor_id and e.payload->>'game'=r.game and e.payload->>'round'=r.round
        and e.created_at>=r.t and e.created_at<${end}))::int finished from rounds r group by game`),
  ]);
  return {
    providers: providers.rows,
    requests: requests.rows[0],
    funnel: funnel.rows[0],
    games: games.rows,
  };
}

export async function audience(start: Date, end: Date) {
  const [pages, repeat] = await Promise.all([
    db.execute<{ page: string; sessions: number; converted: number }>(sql`
      with visits as (select visitor_id, session_id,payload->>'page' page,min(created_at) t
        from events where type='page_view' and member_id is null and session_id is not null and visitor_id is not null
        and created_at>=${start} and created_at<${end} group by 1,2,3)
      select page,count(*)::int sessions,count(*) filter(where exists(
        select 1 from events s join events f on f.type='signup_completed' and f.payload->>'attempt'=s.event_key::text
        where s.type='oauth_started' and s.session_id=v.session_id and s.visitor_id=v.visitor_id
        and s.payload->>'page'=v.page and s.created_at>=v.t and s.created_at<${end} and f.created_at>=s.created_at))::int converted
      from visits v group by page order by sessions desc`),
    db.execute<{
      people: number;
      returning: number;
      since: Date;
    }>(sql`with recent as (
      select distinct visitor_id from events where type='page_view' and visitor_id is not null and created_at>=${start} and created_at<${end})
      select count(*)::int people,count(*) filter(where exists(select 1 from events p where p.type='page_view'
        and p.visitor_id=r.visitor_id and p.created_at<${start}))::int as "returning",
        (select min(started_at) from analytics_start) since from recent r`),
  ]);
  return { pages: pages.rows, repeat: repeat.rows[0] };
}

export async function pageTraffic(p: ReturnType<typeof period>, page: string) {
  const scope = sql`type='page_view' and created_at>=${p.start} and created_at<${p.end}
    and (${page}='' or payload->>'page'=${page})`;
  const [series, total] = await Promise.all([
    db.execute<{
      label: string;
      people: number;
      views: number;
    }>(sql`select to_char(date_trunc(${p.unit},created_at at time zone 'Asia/Seoul'),
      case when ${p.unit}='month' then 'YYYY-MM' else 'YYYY-MM-DD' end) label,
      count(distinct visitor_id)::int people,count(*)::int views from events where ${scope} group by 1 order by 1`),
    db.execute<{ people: number; views: number }>(
      sql`select count(distinct visitor_id)::int people,count(*)::int views from events where ${scope}`,
    ),
  ]);
  return { series: series.rows, total: total.rows[0] };
}

export async function requestFormats(start: Date, end: Date) {
  return (
    await db.execute<{
      format: string;
      created: number;
      resolved: number;
      pending: number;
    }>(sql`select coalesce(format,'미지정') format,
    count(*) filter(where created_at>=${start})::int created,count(*) filter(where resolved_at>=${start} and resolved_at<${end})::int resolved,
    count(*) filter(where resolved_at is null or resolved_at>=${end})::int pending from requests where created_at<${end} group by 1 order by created desc`)
  ).rows;
}
