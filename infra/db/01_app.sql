-- RDS용 앱 스키마 (supabase/migrations/*.sql 에서 자동 변환)
-- 변환: users→users, storage.* 제거, Supabase 롤 grant/revoke 제거, extensions→public
-- 적용: 00_authjs.sql(users) 이후 실행.

-- ========== 20261028053340_init_schema.sql ==========
-- 확장 아트 아카이브 릴리스 1 스키마.
-- 접근 경계(eng D6): 모든 테이블은 RLS를 켜고 anon/authenticated 정책을 두지 않는다.
-- 앱 서버만 service role로 읽고 쓴다. 함수도 service_role에게만 실행 권한을 준다.

create extension if not exists pg_trgm with schema public;

-- 카드 -----------------------------------------------------------------------

create table public.sets (
  code text primary key,
  name_ko text not null,
  released_on date
);

-- 정본 키는 한글판 인쇄본 (set_code, collector_number).
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  set_code text not null references public.sets (code),
  collector_number text not null,
  name_ko text not null,
  rarity text,
  illustrator text,
  created_at timestamptz not null default now(),
  unique (set_code, collector_number)
);

create index cards_name_ko_trgm on public.cards using gin (name_ko public.gin_trgm_ops);

-- 같은 그림의 일본판·영문판.
create table public.card_aliases (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  lang text not null check (lang in ('ja', 'en')),
  set_code text not null,
  collector_number text not null,
  name text,
  unique (lang, set_code, collector_number)
);

create index card_aliases_card_id on public.card_aliases (card_id);
create index card_aliases_key on public.card_aliases (set_code, collector_number);
create index card_aliases_name_trgm on public.card_aliases using gin (name public.gin_trgm_ops);

-- MVP에서는 format 라벨로만 참조한다.
create table public.spec_profiles (
  code text primary key check (code in ('9pocket', 'psa', 'brg')),
  name_ko text not null,
  width_mm numeric,
  height_mm numeric
);

insert into public.spec_profiles (code, name_ko) values
  ('9pocket', '9포켓'),
  ('psa', 'PSA'),
  ('brg', 'BRG');

-- 작품 -----------------------------------------------------------------------

create table public.artworks (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id),
  artist_name text not null,
  format text not null references public.spec_profiles (code),
  source_url text,
  source_visibility text check (source_visibility in ('public', 'members_only')),
  consent_level text not null check (consent_level in ('link_only', 'hosted')),
  thumbnail_ok boolean not null default false,
  status text not null default 'active' check (status in ('active', 'hidden', 'withdrawn')),
  files_purged boolean not null default false,
  upload_id uuid unique,
  link_status text not null default 'unchecked'
    check (link_status in ('unchecked', 'ok', 'deleted', 'no_access', 'suspect')),
  link_checked_at timestamptz,
  print_size_verified boolean not null default false,
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- 링크만 허락한 작품은 연결할 원본 글이 있어야 한다.
  constraint link_only_needs_source check (consent_level = 'hosted' or source_url is not null),
  constraint visibility_with_source check ((source_url is null) = (source_visibility is null))
);

create index artworks_card_status on public.artworks (card_id, status);

create table public.artwork_files (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  kind text not null check (kind in ('original', 'thumbnail')),
  path text not null unique,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now(),
  unique (artwork_id, kind)
);

-- 상태·허락 변경 이력. lib/artworks의 setStatus/setConsent만 쓴다.
create table public.consent_events (
  id bigint generated always as identity primary key,
  artwork_id uuid not null references public.artworks (id),
  kind text not null check (kind in ('created', 'status', 'consent')),
  before jsonb,
  after jsonb not null,
  reason text,
  evidence_path text,
  actor text,
  created_at timestamptz not null default now()
);

create index consent_events_artwork on public.consent_events (artwork_id, created_at);

-- 수요·측정 -------------------------------------------------------------------

-- 방문자가 누른 "찾기 요청". 같은 방문자는 카드·규격당 한 번.
create table public.requests (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.cards (id),
  format text not null references public.spec_profiles (code),
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  unique (card_id, format, visitor_id)
);

-- 카드는 있으나 해당 규격 active 도안이 0개였던 방문.
create table public.card_demand (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.cards (id),
  format text references public.spec_profiles (code),
  visitor_id uuid not null,
  created_at timestamptz not null default now()
);

create index card_demand_card on public.card_demand (card_id);

-- 카드를 찾지 못한 검색.
create table public.search_misses (
  id bigint generated always as identity primary key,
  query text not null,
  parsed jsonb,
  visitor_id uuid,
  created_at timestamptz not null default now()
);

create table public.events (
  id bigint generated always as identity primary key,
  type text not null check (type in ('visit', 'search', 'download', 'source_click', 'request')),
  visitor_id uuid,
  card_id uuid references public.cards (id),
  artwork_id uuid references public.artworks (id),
  payload jsonb,
  created_at timestamptz not null default now()
);

create index events_type_created on public.events (type, created_at);
create index events_visitor on public.events (visitor_id, created_at);

-- 신고 -----------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid references public.artworks (id),
  source_url text,
  reason text not null check (reason in ('rights_holder', 'suspected_theft', 'other')),
  contact text,
  message text,
  status text not null default 'open' check (status in ('open', 'resolved', 'no_target')),
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint report_has_target check (artwork_id is not null or source_url is not null)
);

create index reports_status on public.reports (status, created_at);

-- 어드민 허용 목록 ---------------------------------------------------------------

create table public.admins (
  user_id uuid primary key references users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

-- RLS: 켜고 정책은 두지 않는다 ---------------------------------------------------------

alter table public.sets enable row level security;
alter table public.cards enable row level security;
alter table public.card_aliases enable row level security;
alter table public.spec_profiles enable row level security;
alter table public.artworks enable row level security;
alter table public.artwork_files enable row level security;
alter table public.consent_events enable row level security;
alter table public.requests enable row level security;
alter table public.card_demand enable row level security;
alter table public.search_misses enable row level security;
alter table public.events enable row level security;
alter table public.reports enable row level security;
alter table public.admins enable row level security;

-- 저장소 버킷 ------------------------------------------------------------------


-- ========== 20261028054248_search_functions.sql ==========
-- 카드 검색 (eng D7). lib/search.parseQuery가 정규화한 값을 받아 정확 매칭한다.

-- "001" → "1", "tg01" → "TG1". lib/search.normalizeNumber와 같은 규칙.
create function public.normalize_collector_number(token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(coalesce(substring(token from '^([A-Za-z]*)'), ''))
      || coalesce(nullif(ltrim(substring(token from '(\d+)$'), '0'), ''), '0')
$$;

-- 세트 코드는 대소문자를 구분하지 않는다("MEW" = "mew").
create index cards_number_norm on public.cards (
  lower(set_code),
  public.normalize_collector_number(split_part(collector_number, '/', 1))
);
create index card_aliases_number_norm on public.card_aliases (
  lower(set_code),
  public.normalize_collector_number(split_part(collector_number, '/', 1))
);

-- 검색 결과 한 줄: 정본 카드 + 공개 도안 수 + 어떤 별칭으로 맞았는지.
create type public.card_hit as (
  card_id uuid,
  set_code text,
  collector_number text,
  name_ko text,
  rarity text,
  set_name text,
  released_on date,
  artwork_count int,
  alias_lang text,
  alias_set_code text,
  alias_number text
);

-- p_set이 null이면 번호만으로 찾는다.
create function public.search_cards_by_number(p_set text, p_number text, p_total text)
returns setof public.card_hit
language sql
stable
set search_path = ''
as $$
  with matched as (
    select c.id as card_id, null::text as alias_lang, null::text as alias_set_code,
           null::text as alias_number
    from public.cards c
    where (p_set is null or lower(c.set_code) = lower(p_set))
      and public.normalize_collector_number(split_part(c.collector_number, '/', 1)) = p_number
      and (p_total is null
           or public.normalize_collector_number(split_part(c.collector_number, '/', 2)) = p_total)
    union all
    select a.card_id, a.lang, a.set_code, a.collector_number
    from public.card_aliases a
    where (p_set is null or lower(a.set_code) = lower(p_set))
      and public.normalize_collector_number(split_part(a.collector_number, '/', 1)) = p_number
      and (p_total is null
           or public.normalize_collector_number(split_part(a.collector_number, '/', 2)) = p_total)
  ),
  -- 같은 카드가 정본과 별칭으로 둘 다 맞으면 정본 쪽을 남긴다.
  best as (
    select distinct on (card_id) *
    from matched
    order by card_id, alias_lang nulls first
  )
  select c.id, c.set_code, c.collector_number, c.name_ko, c.rarity, s.name_ko, s.released_on,
         (select count(*)::int from public.artworks w
           where w.card_id = c.id and w.status = 'active'),
         b.alias_lang, b.alias_set_code, b.alias_number
  from best b
  join public.cards c on c.id = b.card_id
  join public.sets s on s.code = c.set_code
  order by 8 desc, s.released_on desc nulls last, c.collector_number
  limit 50
$$;

-- 한글 이름 또는 별칭 이름 부분 검색.
create function public.search_cards_by_name(p_text text)
returns setof public.card_hit
language sql
stable
set search_path = ''
as $$
  with matched as (
    select c.id as card_id,
           public.similarity(c.name_ko, p_text) as score
    from public.cards c
    where c.name_ko operator(public.%) p_text or c.name_ko ilike '%' || p_text || '%'
    union all
    select a.card_id, public.similarity(a.name, p_text)
    from public.card_aliases a
    where a.name operator(public.%) p_text or a.name ilike '%' || p_text || '%'
  ),
  best as (
    select card_id, max(score) as score from matched group by card_id
  )
  select c.id, c.set_code, c.collector_number, c.name_ko, c.rarity, s.name_ko, s.released_on,
         (select count(*)::int from public.artworks w
           where w.card_id = c.id and w.status = 'active'),
         null::text, null::text, null::text
  from best b
  join public.cards c on c.id = b.card_id
  join public.sets s on s.code = c.set_code
  order by 8 desc, b.score desc, s.released_on desc nulls last, c.collector_number
  limit 50
$$;


-- ========== 20261028074052_artwork_functions.sql ==========
-- 작품 생성·상태·허락 변경 (eng D5, D9, D10).
-- 상태와 허락은 이 함수들로만 바뀌고, 같은 트랜잭션에서 consent_events를 남긴다.
-- 파일 삭제는 DB가 커밋된 뒤 lib/artworks가 한다. 함수는 지울 경로만 돌려준다(DB가 기준).
--
--             set_status(hidden)            set_status(withdrawn)
--   active ─────────────────────> hidden ─────────────────────> withdrawn (복구 없음)
--     ^  <──── set_status(active) ───┘                            │ 모든 파일 삭제 대상
--     └───────────────── set_status(withdrawn) ──────────────────┘
--   set_consent: hosted → link_only  ⇒ 원본 삭제 대상
--                thumbnail_ok → false ⇒ 썸네일 삭제 대상

-- 오류는 'P0001' + 짧은 코드 문자열로 낸다. lib/artworks가 코드를 화면 문구로 바꾼다.

create function public.artwork_create(p_artwork jsonb, p_files jsonb, p_actor text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_artwork ->> 'id')::uuid;
  v_consent text := p_artwork ->> 'consent_level';
  v_thumb boolean := coalesce((p_artwork ->> 'thumbnail_ok')::boolean, false);
begin
  -- 업로드 확정 재시도는 같은 id로 들어온다(멱등).
  if exists (select 1 from public.artworks where id = v_id) then
    return v_id;
  end if;

  if v_consent = 'hosted' and not exists (
    select 1 from jsonb_array_elements(p_files) f where f ->> 'kind' = 'original'
  ) then
    raise exception 'hosted_needs_original';
  end if;
  if v_thumb and not exists (
    select 1 from jsonb_array_elements(p_files) f where f ->> 'kind' = 'thumbnail'
  ) then
    raise exception 'thumbnail_needs_file';
  end if;

  insert into public.artworks (
    id, upload_id, card_id, artist_name, format, source_url, source_visibility,
    consent_level, thumbnail_ok, print_size_verified, consented_at
  ) values (
    v_id, v_id,
    (p_artwork ->> 'card_id')::uuid,
    p_artwork ->> 'artist_name',
    p_artwork ->> 'format',
    nullif(p_artwork ->> 'source_url', ''),
    nullif(p_artwork ->> 'source_visibility', ''),
    v_consent,
    v_thumb,
    coalesce((p_artwork ->> 'print_size_verified')::boolean, false),
    coalesce((p_artwork ->> 'consented_at')::timestamptz, now())
  );

  insert into public.artwork_files (artwork_id, kind, path, mime_type, size_bytes)
  select v_id, f ->> 'kind', f ->> 'path', f ->> 'mime_type', (f ->> 'size_bytes')::bigint
  from jsonb_array_elements(p_files) f;

  insert into public.consent_events (artwork_id, kind, before, after, evidence_path, actor)
  values (
    v_id, 'created', null,
    jsonb_build_object('status', 'active', 'consent_level', v_consent, 'thumbnail_ok', v_thumb),
    nullif(p_artwork ->> 'evidence_path', ''),
    p_actor
  );

  return v_id;
end;
$$;

create function public.artwork_set_status(p_id uuid, p_to text, p_reason text, p_actor text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_from text;
  v_purge text[] := '{}';
begin
  select status into v_from from public.artworks where id = p_id for update;
  if v_from is null then
    raise exception 'not_found';
  end if;
  if v_from = p_to then
    return jsonb_build_object('changed', false, 'purge_paths', to_jsonb(v_purge));
  end if;
  if v_from = 'withdrawn' then
    raise exception 'withdrawn_is_final';
  end if;
  if p_to not in ('active', 'hidden', 'withdrawn') then
    raise exception 'invalid_status';
  end if;

  update public.artworks
  set status = p_to,
      files_purged = case when p_to = 'withdrawn' then false else files_purged end
  where id = p_id;

  if p_to = 'withdrawn' then
    select coalesce(array_agg(path), '{}') into v_purge
    from public.artwork_files where artwork_id = p_id;
    if cardinality(v_purge) = 0 then
      update public.artworks set files_purged = true where id = p_id;
    end if;
  end if;

  insert into public.consent_events (artwork_id, kind, before, after, reason, actor)
  values (p_id, 'status', jsonb_build_object('status', v_from), jsonb_build_object('status', p_to),
          p_reason, p_actor);

  return jsonb_build_object('changed', true, 'purge_paths', to_jsonb(v_purge));
end;
$$;

create function public.artwork_set_consent(
  p_id uuid,
  p_consent_level text,
  p_thumbnail_ok boolean,
  p_reason text,
  p_actor text,
  p_evidence_path text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v public.artworks;
  v_purge text[] := '{}';
begin
  select * into v from public.artworks where id = p_id for update;
  if v.id is null then
    raise exception 'not_found';
  end if;
  if v.status = 'withdrawn' then
    raise exception 'withdrawn_is_final';
  end if;
  if v.consent_level = p_consent_level and v.thumbnail_ok = p_thumbnail_ok then
    return jsonb_build_object('changed', false, 'purge_paths', to_jsonb(v_purge));
  end if;
  if p_consent_level = 'link_only' and v.source_url is null then
    raise exception 'link_only_needs_source';
  end if;
  -- 상향은 파일이 이미 붙어 있을 때만. 파일 없이 "다운로드 가능"이 되지 않게 한다.
  if p_consent_level = 'hosted' and not exists (
    select 1 from public.artwork_files where artwork_id = p_id and kind = 'original'
  ) then
    raise exception 'hosted_needs_original';
  end if;
  if p_thumbnail_ok and not exists (
    select 1 from public.artwork_files where artwork_id = p_id and kind = 'thumbnail'
  ) then
    raise exception 'thumbnail_needs_file';
  end if;

  if v.consent_level = 'hosted' and p_consent_level = 'link_only' then
    v_purge := v_purge || array(
      select path from public.artwork_files where artwork_id = p_id and kind = 'original');
  end if;
  if v.thumbnail_ok and not p_thumbnail_ok then
    v_purge := v_purge || array(
      select path from public.artwork_files where artwork_id = p_id and kind = 'thumbnail');
  end if;

  update public.artworks
  set consent_level = p_consent_level, thumbnail_ok = p_thumbnail_ok, consented_at = now()
  where id = p_id;

  insert into public.consent_events (artwork_id, kind, before, after, reason, evidence_path, actor)
  values (
    p_id, 'consent',
    jsonb_build_object('consent_level', v.consent_level, 'thumbnail_ok', v.thumbnail_ok),
    jsonb_build_object('consent_level', p_consent_level, 'thumbnail_ok', p_thumbnail_ok),
    p_reason, nullif(p_evidence_path, ''), p_actor
  );

  return jsonb_build_object('changed', true, 'purge_paths', to_jsonb(v_purge));
end;
$$;

-- 기존 작품에 파일을 붙이거나 바꾼다. 바뀐 파일의 이전 경로를 돌려준다(삭제 대상).
create function public.artwork_attach_file(
  p_id uuid, p_kind text, p_path text, p_mime_type text, p_size_bytes bigint
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
  v_old text;
begin
  select status into v_status from public.artworks where id = p_id for update;
  if v_status is null then
    raise exception 'not_found';
  end if;
  if v_status = 'withdrawn' then
    raise exception 'withdrawn_is_final';
  end if;

  select path into v_old from public.artwork_files where artwork_id = p_id and kind = p_kind;
  if v_old = p_path then
    return jsonb_build_object('purge_paths', '[]'::jsonb);
  end if;

  insert into public.artwork_files (artwork_id, kind, path, mime_type, size_bytes)
  values (p_id, p_kind, p_path, p_mime_type, p_size_bytes)
  on conflict (artwork_id, kind) do update
    set path = excluded.path, mime_type = excluded.mime_type, size_bytes = excluded.size_bytes,
        created_at = now();

  return jsonb_build_object(
    'purge_paths', case when v_old is null then '[]'::jsonb else jsonb_build_array(v_old) end);
end;
$$;

-- 저장소에서 실제로 지운 뒤 호출한다. 철회 작품의 파일이 모두 사라지면 files_purged = true.
create function public.artwork_files_removed(p_paths text[])
returns void
language sql
set search_path = ''
as $$
  delete from public.artwork_files where path = any (p_paths);
  update public.artworks a
  set files_purged = true
  where a.status = 'withdrawn' and not a.files_purged
    and not exists (select 1 from public.artwork_files f where f.artwork_id = a.id);
$$;


-- ========== 20261028091541_requests_reports.sql ==========
-- 찾기 요청·신고·링크 점검 (design 5A·14A, eng E5·E6·E7).

-- 신고 남용 방지 카운터. IP 대역(IPv4 /24, IPv6 /48)의 HMAC만 저장하고 24시간 뒤 정리 작업이 지운다.
-- reports·events에는 IP를 쓰지 않는다 (설계 "신고 흐름").
create table public.report_throttle (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  artwork_id uuid references public.artworks (id),
  created_at timestamptz not null default now()
);

create index report_throttle_hash on public.report_throttle (ip_hash, created_at);
create index report_throttle_artwork on public.report_throttle (artwork_id, created_at);
alter table public.report_throttle enable row level security;

-- 신고 저장. 하루 5건 한도를 넘으면 rate_limited.
-- 같은 작품에 24시간 안에 서로 다른 대역 3곳이 신고하면 auto_hide = true를 돌려준다.
-- 숨김은 lib/reports가 setStatus 경로로 한다(상태 변경 경로를 하나로 유지).
create function public.report_submit(p_report jsonb, p_ip_hash text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_artwork uuid := nullif(p_report ->> 'artwork_id', '')::uuid;
  v_id uuid;
  v_ranges int := 0;
begin
  if (select count(*) from public.report_throttle
      where ip_hash = p_ip_hash and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'rate_limited';
  end if;
  if v_artwork is not null and not exists (select 1 from public.artworks where id = v_artwork) then
    raise exception 'not_found';
  end if;

  insert into public.reports (artwork_id, source_url, reason, contact, message)
  values (
    v_artwork,
    nullif(p_report ->> 'source_url', ''),
    p_report ->> 'reason',
    nullif(p_report ->> 'contact', ''),
    nullif(p_report ->> 'message', '')
  )
  returning id into v_id;

  insert into public.report_throttle (ip_hash, artwork_id) values (p_ip_hash, v_artwork);

  if v_artwork is not null then
    select count(distinct ip_hash) into v_ranges from public.report_throttle
    where artwork_id = v_artwork and created_at > now() - interval '24 hours';
  end if;

  return jsonb_build_object('id', v_id, 'auto_hide', v_ranges >= 3);
end;
$$;

-- 찾기 요청. 같은 방문자·카드·규격은 한 번만 센다.
create function public.request_create(p_card uuid, p_format text, p_visitor uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_inserted int;
begin
  insert into public.requests (card_id, format, visitor_id)
  values (p_card, p_format, p_visitor)
  on conflict (card_id, format, visitor_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then
    insert into public.events (type, visitor_id, card_id, payload)
    values ('request', p_visitor, p_card, jsonb_build_object('format', p_format));
  end if;
  return v_inserted > 0;
end;
$$;

-- 규격별 요청 상태. 대기 수는 3명 이상일 때만 숫자로 준다 (design 5A).
create function public.card_request_state(p_card uuid, p_visitor uuid)
returns table (format text, requested boolean, waiting int)
language sql
stable
set search_path = ''
as $$
  select s.code,
         exists (select 1 from public.requests r
                 where r.card_id = p_card and r.format = s.code and r.visitor_id = p_visitor),
         case when n.c >= 3 then n.c::int end
  from public.spec_profiles s
  cross join lateral (
    select count(*) as c from public.requests r where r.card_id = p_card and r.format = s.code
  ) n
  order by s.code
$$;

-- 홈 "최근 도안이 등록된 카드" (design 3A).
create function public.recent_artwork_cards(p_limit int)
returns table (set_code text, collector_number text, name_ko text, latest timestamptz)
language sql
stable
set search_path = ''
as $$
  select c.set_code, c.collector_number, c.name_ko, max(a.created_at)
  from public.artworks a
  join public.cards c on c.id = a.card_id
  where a.status = 'active'
  group by c.id
  order by 4 desc
  limit p_limit
$$;

-- 수동 링크 점검 기록 (eng E6).
create function public.artwork_set_link_status(p_id uuid, p_status text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_status not in ('ok', 'deleted', 'no_access', 'suspect') then
    raise exception 'invalid_link_status';
  end if;
  update public.artworks set link_status = p_status, link_checked_at = now() where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;


-- ========== 20261028120000_review_fixes.sql ==========
-- 머지 전 리뷰 수정.
-- 1. 허락 하향 시 파일 행을 바로 지운다(저장소 삭제 실패 시 정리 작업이 다시 지울 수 있게).
-- 2. 신고 한도와 자동 숨김이 동시 요청에도 지켜지도록 잠금을 건다.
-- create or replace는 기존 권한(revoke/grant)을 유지한다.

create or replace function public.artwork_set_consent(
  p_id uuid,
  p_consent_level text,
  p_thumbnail_ok boolean,
  p_reason text,
  p_actor text,
  p_evidence_path text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v public.artworks;
  v_purge text[] := '{}';
begin
  select * into v from public.artworks where id = p_id for update;
  if v.id is null then
    raise exception 'not_found';
  end if;
  if v.status = 'withdrawn' then
    raise exception 'withdrawn_is_final';
  end if;
  if v.consent_level = p_consent_level and v.thumbnail_ok = p_thumbnail_ok then
    return jsonb_build_object('changed', false, 'purge_paths', to_jsonb(v_purge));
  end if;
  if p_consent_level = 'link_only' and v.source_url is null then
    raise exception 'link_only_needs_source';
  end if;
  -- 상향은 파일이 이미 붙어 있을 때만. 파일 없이 "다운로드 가능"이 되지 않게 한다.
  if p_consent_level = 'hosted' and not exists (
    select 1 from public.artwork_files where artwork_id = p_id and kind = 'original'
  ) then
    raise exception 'hosted_needs_original';
  end if;
  if p_thumbnail_ok and not exists (
    select 1 from public.artwork_files where artwork_id = p_id and kind = 'thumbnail'
  ) then
    raise exception 'thumbnail_needs_file';
  end if;

  if v.consent_level = 'hosted' and p_consent_level = 'link_only' then
    v_purge := v_purge || array(
      select path from public.artwork_files where artwork_id = p_id and kind = 'original');
  end if;
  if v.thumbnail_ok and not p_thumbnail_ok then
    v_purge := v_purge || array(
      select path from public.artwork_files where artwork_id = p_id and kind = 'thumbnail');
  end if;

  update public.artworks
  set consent_level = p_consent_level, thumbnail_ok = p_thumbnail_ok, consented_at = now()
  where id = p_id;

  insert into public.consent_events (artwork_id, kind, before, after, reason, evidence_path, actor)
  values (
    p_id, 'consent',
    jsonb_build_object('consent_level', v.consent_level, 'thumbnail_ok', v.thumbnail_ok),
    jsonb_build_object('consent_level', p_consent_level, 'thumbnail_ok', p_thumbnail_ok),
    p_reason, nullif(p_evidence_path, ''), p_actor
  );

  -- 하향된 파일은 같은 트랜잭션에서 추적을 끊는다. 커밋 뒤 저장소 삭제가 실패해도
  -- 정리 작업이 "행 없는 파일"로 보고 다시 지운다.
  delete from public.artwork_files where path = any (v_purge);

  return jsonb_build_object('changed', true, 'purge_paths', to_jsonb(v_purge));
end;
$$;

create or replace function public.report_submit(p_report jsonb, p_ip_hash text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_artwork uuid := nullif(p_report ->> 'artwork_id', '')::uuid;
  v_id uuid;
  v_ranges int := 0;
begin
  -- 같은 대역의 동시 신고가 한도를 함께 통과하지 않게, 같은 작품의 동시 신고가 자동 숨김을 놓치지 않게 잠근다.
  perform pg_advisory_xact_lock(hashtext('report_ip:' || p_ip_hash));
  if v_artwork is not null then
    perform pg_advisory_xact_lock(hashtext('report_artwork:' || v_artwork::text));
  end if;
  if (select count(*) from public.report_throttle
      where ip_hash = p_ip_hash and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'rate_limited';
  end if;
  if v_artwork is not null and not exists (select 1 from public.artworks where id = v_artwork) then
    raise exception 'not_found';
  end if;

  insert into public.reports (artwork_id, source_url, reason, contact, message)
  values (
    v_artwork,
    nullif(p_report ->> 'source_url', ''),
    p_report ->> 'reason',
    nullif(p_report ->> 'contact', ''),
    nullif(p_report ->> 'message', '')
  )
  returning id into v_id;

  insert into public.report_throttle (ip_hash, artwork_id) values (p_ip_hash, v_artwork);

  if v_artwork is not null then
    select count(distinct ip_hash) into v_ranges from public.report_throttle
    where artwork_id = v_artwork and created_at > now() - interval '24 hours';
  end if;

  return jsonb_build_object('id', v_id, 'auto_hide', v_ranges >= 3);
end;
$$;

-- ========== 20261028130000_cards_import.sql ==========
-- 카드 시드 CSV 가져오기 (설계 "카드 식별"). lib/card-import가 검사한 행을 받아 한 트랜잭션으로 넣는다.
--   - 카드는 (set_code, collector_number)로 upsert한다. 다시 돌려도 같은 결과(멱등).
--   - CSV에 있는 카드의 별칭은 파일 내용으로 바꾼다(별칭은 이 경로로만 들어온다).
--   - 문제가 하나라도 있으면 아무것도 쓰지 않고 errors를 돌려준다.
--   - p_dry_run이면 검사와 집계만 하고 쓰지 않는다.

create function public.cards_import(p_sets jsonb, p_cards jsonb, p_dry_run boolean)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_errors jsonb;
  v_inserted int;
  v_updated int;
  v_aliases int;
begin
  create temp table import_cards on commit drop as
  select (c ->> 'line')::int as line,
         c ->> 'set_code' as set_code,
         c ->> 'collector_number' as collector_number,
         c ->> 'name_ko' as name_ko,
         c ->> 'rarity' as rarity,
         c ->> 'illustrator' as illustrator,
         coalesce(c -> 'aliases', '[]'::jsonb) as aliases
  from jsonb_array_elements(p_cards) c;

  create temp table import_aliases on commit drop as
  select ic.line, ic.set_code as card_set, ic.collector_number as card_number,
         a ->> 'lang' as lang, a ->> 'set_code' as set_code,
         a ->> 'collector_number' as collector_number, a ->> 'name' as name
  from import_cards ic, jsonb_array_elements(ic.aliases) a;

  -- 1. DB에도 없고 파일에서도 이름을 주지 않은 세트
  -- 2. 이미 다른 카드에 붙어 있는 별칭(같은 언어·세트·번호)
  select coalesce(jsonb_agg(e order by (e ->> 'line')::int), '[]'::jsonb) into v_errors
  from (
    select jsonb_build_object(
             'line', ic.line,
             'message', format('세트 %s가 DB에 없어요. set_name_ko 컬럼으로 세트 이름을 함께 주세요.', ic.set_code)) as e
    from import_cards ic
    where not exists (select 1 from public.sets s where s.code = ic.set_code)
      and not exists (select 1 from jsonb_array_elements(p_sets) ps where ps ->> 'code' = ic.set_code)
    union all
    select jsonb_build_object(
             'line', ia.line,
             'message', format('별칭 %s %s %s가 이미 다른 카드(%s %s)에 붙어 있어요.',
                               ia.lang, ia.set_code, ia.collector_number, c.set_code, c.collector_number))
    from import_aliases ia
    join public.card_aliases a
      on a.lang = ia.lang and lower(a.set_code) = lower(ia.set_code) and a.collector_number = ia.collector_number
    join public.cards c on c.id = a.card_id
    -- 주인 카드도 이번 파일에 있으면 그 별칭은 어차피 바뀌므로 충돌이 아니다.
    where not exists (
      select 1 from import_cards o where o.set_code = c.set_code and o.collector_number = c.collector_number)
  ) problems;

  if jsonb_array_length(v_errors) > 0 then
    return jsonb_build_object('ok', false, 'errors', v_errors);
  end if;

  select count(*) filter (where c.id is null), count(*) filter (where c.id is not null)
  into v_inserted, v_updated
  from import_cards ic
  left join public.cards c on c.set_code = ic.set_code and c.collector_number = ic.collector_number;
  select count(*) into v_aliases from import_aliases;

  if p_dry_run then
    return jsonb_build_object('ok', true, 'dry_run', true,
      'inserted', v_inserted, 'updated', v_updated, 'aliases', v_aliases);
  end if;

  insert into public.sets (code, name_ko)
  select ps ->> 'code', ps ->> 'name_ko' from jsonb_array_elements(p_sets) ps
  on conflict (code) do update set name_ko = excluded.name_ko;

  insert into public.cards (set_code, collector_number, name_ko, rarity, illustrator)
  select set_code, collector_number, name_ko, rarity, illustrator from import_cards
  on conflict (set_code, collector_number) do update
    set name_ko = excluded.name_ko, rarity = excluded.rarity, illustrator = excluded.illustrator;

  delete from public.card_aliases a
  using public.cards c, import_cards ic
  where a.card_id = c.id and c.set_code = ic.set_code and c.collector_number = ic.collector_number;

  insert into public.card_aliases (card_id, lang, set_code, collector_number, name)
  select c.id, ia.lang, ia.set_code, ia.collector_number, ia.name
  from import_aliases ia
  join public.cards c on c.set_code = ia.card_set and c.collector_number = ia.card_number;

  return jsonb_build_object('ok', true, 'dry_run', false,
    'inserted', v_inserted, 'updated', v_updated, 'aliases', v_aliases);
end;
$$;


-- ========== 20261028140000_consent_evidence.sql ==========
-- 허락 근거 업로드 (설계 R3).
-- 허락 변경 없이 근거 파일만 붙여도 consent_events에 남긴다. 그러지 않으면 올린 파일이
-- 기록 없이 정리 작업에 지워진다.
-- create or replace는 기존 권한(revoke/grant)을 유지한다.

create or replace function public.artwork_set_consent(
  p_id uuid,
  p_consent_level text,
  p_thumbnail_ok boolean,
  p_reason text,
  p_actor text,
  p_evidence_path text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v public.artworks;
  v_purge text[] := '{}';
begin
  select * into v from public.artworks where id = p_id for update;
  if v.id is null then
    raise exception 'not_found';
  end if;
  if v.status = 'withdrawn' then
    raise exception 'withdrawn_is_final';
  end if;
  if v.consent_level = p_consent_level and v.thumbnail_ok = p_thumbnail_ok then
    -- 허락은 그대로지만 근거 파일을 새로 붙였다면 기록만 남긴다(before = after).
    if nullif(p_evidence_path, '') is not null then
      insert into public.consent_events (artwork_id, kind, before, after, reason, evidence_path, actor)
      values (
        p_id, 'consent',
        jsonb_build_object('consent_level', v.consent_level, 'thumbnail_ok', v.thumbnail_ok),
        jsonb_build_object('consent_level', v.consent_level, 'thumbnail_ok', v.thumbnail_ok),
        p_reason, p_evidence_path, p_actor
      );
    end if;
    return jsonb_build_object('changed', false, 'purge_paths', to_jsonb(v_purge));
  end if;
  if p_consent_level = 'link_only' and v.source_url is null then
    raise exception 'link_only_needs_source';
  end if;
  -- 상향은 파일이 이미 붙어 있을 때만. 파일 없이 "다운로드 가능"이 되지 않게 한다.
  if p_consent_level = 'hosted' and not exists (
    select 1 from public.artwork_files where artwork_id = p_id and kind = 'original'
  ) then
    raise exception 'hosted_needs_original';
  end if;
  if p_thumbnail_ok and not exists (
    select 1 from public.artwork_files where artwork_id = p_id and kind = 'thumbnail'
  ) then
    raise exception 'thumbnail_needs_file';
  end if;

  if v.consent_level = 'hosted' and p_consent_level = 'link_only' then
    v_purge := v_purge || array(
      select path from public.artwork_files where artwork_id = p_id and kind = 'original');
  end if;
  if v.thumbnail_ok and not p_thumbnail_ok then
    v_purge := v_purge || array(
      select path from public.artwork_files where artwork_id = p_id and kind = 'thumbnail');
  end if;

  update public.artworks
  set consent_level = p_consent_level, thumbnail_ok = p_thumbnail_ok, consented_at = now()
  where id = p_id;

  insert into public.consent_events (artwork_id, kind, before, after, reason, evidence_path, actor)
  values (
    p_id, 'consent',
    jsonb_build_object('consent_level', v.consent_level, 'thumbnail_ok', v.thumbnail_ok),
    jsonb_build_object('consent_level', p_consent_level, 'thumbnail_ok', p_thumbnail_ok),
    p_reason, nullif(p_evidence_path, ''), p_actor
  );

  -- 하향된 파일은 같은 트랜잭션에서 추적을 끊는다. 커밋 뒤 저장소 삭제가 실패해도
  -- 정리 작업이 "행 없는 파일"로 보고 다시 지운다.
  delete from public.artwork_files where path = any (v_purge);

  return jsonb_build_object('changed', true, 'purge_paths', to_jsonb(v_purge));
end;
$$;

-- ========== 20261029090000_archive_only.sql ==========
-- 보관 전용 아카이브로 전환.
-- 링크만 모으지 않고 도안 파일을 사이트에 보관한다. 모든 작품은 원본과 미리보기 파일을 가진다.
--   - consent_level(link_only/hosted), thumbnail_ok 구분을 없앤다. 등록 = 보관·미리보기·다운로드 허락.
--   - 원본 글 주소는 출처 표시용(선택)이다.
--   - 허락 변경(하향)은 없다. 내리고 싶으면 숨김 또는 철회. 허락 근거는 artwork_add_evidence로 덧붙인다.
-- 미리보기(kind = thumbnail)는 서버가 원본에서 만든다(lib/preview). PDF 원본은 어드민이 직접 올린다.

-- 링크 전용이거나 파일이 빠진 공개·숨김 작품이 남아 있으면 전환하지 않는다(배포 전이라 없어야 한다).
do $$
begin
  if exists (
    select 1 from public.artworks a
    where a.status <> 'withdrawn'
      and (
        a.consent_level <> 'hosted'
        or not exists (select 1 from public.artwork_files f where f.artwork_id = a.id and f.kind = 'original')
        or not exists (select 1 from public.artwork_files f where f.artwork_id = a.id and f.kind = 'thumbnail')
      )
  ) then
    raise exception 'archive_only: link-only or file-less artworks exist; withdraw them first';
  end if;
end;
$$;

drop function public.artwork_set_consent(uuid, text, boolean, text, text, text);

alter table public.artworks
  drop constraint link_only_needs_source,
  drop column consent_level,
  drop column thumbnail_ok;

-- 미리보기는 webp로 만든다.

create or replace function public.artwork_create(p_artwork jsonb, p_files jsonb, p_actor text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_artwork ->> 'id')::uuid;
begin
  -- 업로드 확정 재시도는 같은 id로 들어온다(멱등).
  if exists (select 1 from public.artworks where id = v_id) then
    return v_id;
  end if;

  if not exists (select 1 from jsonb_array_elements(p_files) f where f ->> 'kind' = 'original') then
    raise exception 'original_required';
  end if;
  if not exists (select 1 from jsonb_array_elements(p_files) f where f ->> 'kind' = 'thumbnail') then
    raise exception 'thumbnail_required';
  end if;

  insert into public.artworks (
    id, upload_id, card_id, artist_name, format, source_url, source_visibility,
    print_size_verified, consented_at
  ) values (
    v_id, v_id,
    (p_artwork ->> 'card_id')::uuid,
    p_artwork ->> 'artist_name',
    p_artwork ->> 'format',
    nullif(p_artwork ->> 'source_url', ''),
    nullif(p_artwork ->> 'source_visibility', ''),
    coalesce((p_artwork ->> 'print_size_verified')::boolean, false),
    coalesce((p_artwork ->> 'consented_at')::timestamptz, now())
  );

  insert into public.artwork_files (artwork_id, kind, path, mime_type, size_bytes)
  select v_id, f ->> 'kind', f ->> 'path', f ->> 'mime_type', (f ->> 'size_bytes')::bigint
  from jsonb_array_elements(p_files) f;

  insert into public.consent_events (artwork_id, kind, before, after, evidence_path, actor)
  values (
    v_id, 'created', null, jsonb_build_object('status', 'active'),
    nullif(p_artwork ->> 'evidence_path', ''),
    p_actor
  );

  return v_id;
end;
$$;

-- 허락 근거(DM 캡처 등)를 나중에 덧붙인다. 올린 파일이 기록 없이 정리 작업에 지워지지 않게 이벤트로 남긴다.
create function public.artwork_add_evidence(p_id uuid, p_reason text, p_actor text, p_evidence_path text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.artworks where id = p_id for update;
  if v_status is null then
    raise exception 'not_found';
  end if;
  if v_status = 'withdrawn' then
    raise exception 'withdrawn_is_final';
  end if;
  if nullif(p_evidence_path, '') is null then
    raise exception 'evidence_required';
  end if;
  insert into public.consent_events (artwork_id, kind, before, after, reason, evidence_path, actor)
  values (p_id, 'consent', null, jsonb_build_object('evidence', true), p_reason, p_evidence_path, p_actor);
end;
$$;


-- ========== 20261029120000_artists.sql ==========
-- 작가 계정.
-- 누구나 가입할 수 있고, 어드민이 승인한 작가만 도안을 올린다. 올린 도안은 바로 공개한다.
-- 로그인은 카카오·구글뿐이다. 처음 로그인하면 auth 계정이 생기고, 작가 신청 폼을 내야 이 표에 들어간다.
-- lib/artists.ts만 이 표를 쓴다.
-- 작가가 올린 작품은 artworks.artist_id로 계정에 묶이고, 공개 작가 페이지(/artists/[handle])에 모인다.

create table public.artists (
  user_id uuid primary key references users (id) on delete cascade,
  -- 작가 페이지 주소. 영문 소문자·숫자·밑줄.
  handle text not null unique check (handle ~ '^[a-z0-9_]{2,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  email text, -- 소셜 계정의 이메일. 카카오는 비즈 앱이 아니면 주지 않는다.
  provider text not null, -- kakao | google
  intro text check (intro is null or char_length(intro) <= 300),
  link_url text check (link_url is null or link_url ~ '^https?://'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now()
);

create index artists_status on public.artists (status, created_at);

alter table public.artists enable row level security;

-- 계정을 지워도 작품과 이력은 남긴다(작품 이름은 artist_name에 있다).
alter table public.artworks
  add column artist_id uuid references public.artists (user_id) on delete set null;

create index artworks_artist on public.artworks (artist_id, status, created_at);

create or replace function public.artwork_create(p_artwork jsonb, p_files jsonb, p_actor text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_artwork ->> 'id')::uuid;
begin
  -- 업로드 확정 재시도는 같은 id로 들어온다(멱등).
  if exists (select 1 from public.artworks where id = v_id) then
    return v_id;
  end if;

  if not exists (select 1 from jsonb_array_elements(p_files) f where f ->> 'kind' = 'original') then
    raise exception 'original_required';
  end if;
  if not exists (select 1 from jsonb_array_elements(p_files) f where f ->> 'kind' = 'thumbnail') then
    raise exception 'thumbnail_required';
  end if;

  insert into public.artworks (
    id, upload_id, card_id, artist_name, artist_id, format, source_url, source_visibility,
    print_size_verified, consented_at
  ) values (
    v_id, v_id,
    (p_artwork ->> 'card_id')::uuid,
    p_artwork ->> 'artist_name',
    nullif(p_artwork ->> 'artist_id', '')::uuid,
    p_artwork ->> 'format',
    nullif(p_artwork ->> 'source_url', ''),
    nullif(p_artwork ->> 'source_visibility', ''),
    coalesce((p_artwork ->> 'print_size_verified')::boolean, false),
    coalesce((p_artwork ->> 'consented_at')::timestamptz, now())
  );

  insert into public.artwork_files (artwork_id, kind, path, mime_type, size_bytes)
  select v_id, f ->> 'kind', f ->> 'path', f ->> 'mime_type', (f ->> 'size_bytes')::bigint
  from jsonb_array_elements(p_files) f;

  insert into public.consent_events (artwork_id, kind, before, after, evidence_path, actor)
  values (
    v_id, 'created', null, jsonb_build_object('status', 'active'),
    nullif(p_artwork ->> 'evidence_path', ''),
    p_actor
  );

  return v_id;
end;
$$;


-- ========== 20261030090000_search_requests.sql ==========
-- 검색 결과 없음 화면의 "이 번호로 찾기 요청" (design 6A). 지나가며 남는 검색 실패와 구분한다.
alter table public.search_misses add column requested boolean not null default false;

-- ========== 20261031000000_community_ranking.sql ==========
-- 커뮤니티·랭킹·도안 상세 고도화 에픽 (docs/designs/community-ranking-epic.md)
-- 일반 회원(member) · 추천/다운로드 점수(engagements) · 다형 댓글 · 게시판 · 도안 제목 · 회원 요청
-- 모든 테이블 RLS on·정책 없음. 서버 lib/supabase/server.ts의 db()(service_role)로만 접근.

-- #1 일반 회원: 비작가 소셜 유저 식별(닉네임). 첫 참여 시 서버가 소셜 이름으로 생성.
create table public.members (
  user_id uuid primary key references users (id) on delete cascade,
  nickname text not null,
  created_at timestamptz not null default now()
);

-- #2 추천·다운로드 점수: (유저, 도안)당 1행 = 1점. 중복불가(다운로드 or 추천).
create table public.engagements (
  user_id uuid not null references users (id) on delete cascade,
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  kind text not null check (kind in ('download', 'recommend')),
  created_at timestamptz not null default now(),
  primary key (user_id, artwork_id)
);
create index engagements_artwork on public.engagements (artwork_id, kind);
create index engagements_created on public.engagements (created_at);

-- #3/#5 다형 댓글 + 1단계 대댓글. 부모 댓글은 parent_id가 null.
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('artwork', 'post')),
  target_id uuid not null,
  user_id uuid not null references users (id) on delete cascade,
  author_name text not null, -- 작성 시점 표시명 스냅샷(작가 display_name 또는 member nickname)
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index comments_target on public.comments (target_type, target_id, created_at);

-- #5 커뮤니티 게시판.
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  board text not null check (board in ('notice', 'suggestion', 'free')),
  user_id uuid not null references users (id) on delete cascade,
  author_name text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index posts_board on public.posts (board, created_at desc);

-- #3 도안 제목(작가 입력, 기본 "{작가}님의 도안").
alter table public.artworks add column title text;

-- #4 회원 도안 요청. 카드 단위 요청(규격별 "찾기요청"과 분리). 유저당 카드당 1회.
alter table public.requests add column user_id uuid references users (id) on delete cascade;
create unique index requests_card_user on public.requests (card_id, user_id) where user_id is not null;

-- RLS: 전부 켜고 정책 없음(= 익명/anon 접근 차단, 서버 service_role만).
alter table public.members enable row level security;
alter table public.engagements enable row level security;
alter table public.comments enable row level security;
alter table public.posts enable row level security;

-- ========== 20261031000001_requests_nullable_backfill.sql ==========
-- #4 회원 카드단위 요청: format 없이(카드 전체) 요청 가능하게.
alter table public.requests alter column format drop not null;

-- #3 도안 제목 기본 백필: 기존 도안은 "{작가}님의 도안".
update public.artworks set title = artist_name || '님의 도안' where title is null;

-- ========== 20261031000002_requests_visitor_nullable.sql ==========
-- #4 회원 카드단위 요청은 visitor_id 없이 user_id로 기록한다. visitor_id를 nullable로.
-- (익명 규격별 "찾기요청"은 visitor_id, 회원 카드요청은 user_id — 둘 중 하나.)
alter table public.requests alter column visitor_id drop not null;

-- ========== 20261031000003_requests_resolve_format.sql ==========
-- #4 개선: 요청을 규격별로(9포켓/PSA/BRG) 받고, 작가가 그 규격 도안을 올리면 해결 처리.
-- 해결된 요청은 요청방 목록에서 내려가고, 누가 해결했는지(resolved_by)로 작가 프로필에 집계.

alter table public.requests add column resolved_at timestamptz;
alter table public.requests add column resolved_by uuid references users (id);

-- 회원은 카드×규격당 1회 요청(기존 card×user 유니크를 규격 포함으로 교체).
drop index if exists public.requests_card_user;
create unique index requests_card_user_format
  on public.requests (card_id, user_id, format) where user_id is not null;

create index requests_open on public.requests (card_id, format) where resolved_at is null;
create index requests_resolved_by on public.requests (resolved_by) where resolved_by is not null;

-- ========== 20261031000004_formats_extensible_etc.sql ==========
-- 규격 확장 대응: code CHECK를 없애 새 규격을 spec_profiles 행 추가만으로 늘릴 수 있게 한다.
-- artworks.format / requests.format FK가 유효성을 계속 강제한다. 지금은 '기타(etc)' 추가.
alter table public.spec_profiles drop constraint spec_profiles_code_check;

insert into public.spec_profiles (code, name_ko) values ('etc', '기타')
  on conflict (code) do nothing;

-- ========== 20261031000005_artwork_multi_file.sql ==========
-- 다중 파일(규격별): 9포켓=조각 여러 장. artwork_files에 position 추가, (artwork_id,kind) 유니크를 (artwork_id,kind,position)로.
alter table public.artwork_files add column position smallint not null default 0;
alter table public.artwork_files drop constraint if exists artwork_files_artwork_id_kind_key;
alter table public.artwork_files
  add constraint artwork_files_artwork_kind_position_key unique (artwork_id, kind, position);

-- artwork_create: p_files에 position 포함.
create or replace function public.artwork_create(p_artwork jsonb, p_files jsonb, p_actor text)
returns uuid language plpgsql set search_path = '' as $$
declare v_id uuid := (p_artwork ->> 'id')::uuid;
begin
  if exists (select 1 from public.artworks where id = v_id) then return v_id; end if;
  if not exists (select 1 from jsonb_array_elements(p_files) f where f ->> 'kind' = 'original') then
    raise exception 'original_required';
  end if;
  if not exists (select 1 from jsonb_array_elements(p_files) f where f ->> 'kind' = 'thumbnail') then
    raise exception 'thumbnail_required';
  end if;

  insert into public.artworks (
    id, upload_id, card_id, artist_name, artist_id, format, source_url, source_visibility,
    print_size_verified, consented_at
  ) values (
    v_id, v_id, (p_artwork ->> 'card_id')::uuid, p_artwork ->> 'artist_name',
    nullif(p_artwork ->> 'artist_id', '')::uuid, p_artwork ->> 'format',
    nullif(p_artwork ->> 'source_url', ''), nullif(p_artwork ->> 'source_visibility', ''),
    coalesce((p_artwork ->> 'print_size_verified')::boolean, false),
    coalesce((p_artwork ->> 'consented_at')::timestamptz, now())
  );

  insert into public.artwork_files (artwork_id, kind, path, mime_type, size_bytes, position)
  select v_id, f ->> 'kind', f ->> 'path', f ->> 'mime_type', (f ->> 'size_bytes')::bigint,
         coalesce((f ->> 'position')::smallint, 0)
  from jsonb_array_elements(p_files) f;

  insert into public.consent_events (artwork_id, kind, before, after, evidence_path, actor)
  values (v_id, 'created', null, jsonb_build_object('status', 'active'),
          nullif(p_artwork ->> 'evidence_path', ''), p_actor);
  return v_id;
end; $$;

-- attach_file: 단일 파일(position 0) 교체용. 새 유니크 제약에 맞춰 on conflict 갱신.
create or replace function public.artwork_attach_file(
  p_id uuid, p_kind text, p_path text, p_mime_type text, p_size_bytes bigint
)
returns jsonb language plpgsql set search_path = '' as $$
declare v_status text; v_old text;
begin
  select status into v_status from public.artworks where id = p_id for update;
  if v_status is null then raise exception 'not_found'; end if;
  if v_status = 'withdrawn' then raise exception 'withdrawn_is_final'; end if;
  select path into v_old from public.artwork_files
    where artwork_id = p_id and kind = p_kind and position = 0;
  if v_old = p_path then return jsonb_build_object('purge_paths', '[]'::jsonb); end if;
  insert into public.artwork_files (artwork_id, kind, path, mime_type, size_bytes, position)
  values (p_id, p_kind, p_path, p_mime_type, p_size_bytes, 0)
  on conflict (artwork_id, kind, position) do update
    set path = excluded.path, mime_type = excluded.mime_type, size_bytes = excluded.size_bytes,
        created_at = now();
  return jsonb_build_object(
    'purge_paths', case when v_old is null then '[]'::jsonb else jsonb_build_array(v_old) end);
end; $$;


-- ========== 20261031000006_profile_favorites.sql ==========
-- 마이프로필: 회원 프로필 이미지 + 카드 즐겨찾기.
-- members.avatar_path: 회원이 올린 프로필 이미지 경로(artworks 버킷 avatars/<userId>/<uploadId>). 없으면 이니셜.
alter table public.members add column avatar_path text;

-- 카드 즐겨찾기: (회원, 카드)당 1행. 마이프로필에서 모아 본다.
create table public.favorites (
  user_id uuid not null references users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, card_id)
);
create index favorites_user on public.favorites (user_id, created_at desc);

-- RLS: 켜고 정책 없음(= anon 차단, 서버 service_role만). members/engagements와 동일.
alter table public.favorites enable row level security;

-- ========== 20261031000007_artist_reviews.sql ==========
-- 작가 후기: 회원이 작가에게 남기는 이미지+텍스트 후기.
-- 작가 공개페이지·작가 스튜디오·커뮤니티 "작가 후기"에서 함께 보인다.
create table public.artist_reviews (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists (user_id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade, -- 작성 회원
  author_name text not null, -- 작성 시점 표시명 스냅샷
  body text not null,
  image_path text, -- 선택 이미지(artworks 버킷 reviews/<uploadId>)
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index artist_reviews_artist on public.artist_reviews (artist_id, created_at desc);
create index artist_reviews_recent on public.artist_reviews (created_at desc) where deleted_at is null;

-- RLS: 켜고 정책 없음(= anon 차단, 서버 service_role만).
alter table public.artist_reviews enable row level security;

-- ========== 20261103000000_user_is_artist.sql ==========
-- 유저=작가 통합: 승인 제거, members 흡수, handle 발행 전 null 허용.
-- 런칭 전·데이터 폐기 가능 → members는 그냥 drop(데이터 이전 안 함).

-- 1) 승인 흔적 제거
drop index if exists artists_status;
alter table public.artists drop constraint if exists artists_status_check;
alter table public.artists drop column if exists status;
alter table public.artists drop column if exists reviewed_at;
alter table public.artists drop column if exists reviewed_by;

-- 2) handle: 발행 전엔 없음(null 허용). unique·형식 체크는 유지(null은 통과).
alter table public.artists alter column handle drop not null;
alter table public.artists drop constraint if exists artists_handle_check;
alter table public.artists add constraint artists_handle_check
  check (handle is null or handle ~ '^[a-z0-9_]{2,30}$');

-- 3) 프로필 흡수: 아바타 컬럼(= 옛 members.avatar_path)
alter table public.artists add column if not exists avatar_path text;

-- 4) members 폐기(FK는 users만 참조했고 engagements/comments/favorites는 users 직참조)
drop table if exists public.members cascade;

-- 5) 공개/발행 조회용 인덱스(handle 보유 프로필)
create index if not exists artists_published on public.artists (handle) where handle is not null;


-- ========== 20261105000000_post_image.sql ==========
-- 커뮤니티 게시글 이미지 첨부(선택 1장). artworks 버킷 posts/<uploadId>.
alter table public.posts add column if not exists image_path text;
