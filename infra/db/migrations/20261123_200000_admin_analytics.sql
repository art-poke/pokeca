alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (type in (
  'visit','search','download','source_click','request','page_view','page_leave','click',
  'login_prompt_viewed','cta_clicked','cta_impression','oauth_started','login_succeeded','signup_completed','oauth_failed',
  'favorite_added','request_created','artwork_published','artwork_recommended','game_started','game_finished',
  'game_score_saved','story_read','story_liked','post_published','comment_created','review_created'
));
alter table public.events add column event_key uuid, add column session_id uuid,
  add column member_id uuid references public.users(id) on delete set null;
create unique index events_key_uq on public.events(event_key);
create unique index events_first_signup on public.events(member_id) where type='signup_completed';
create index events_session_time on public.events(session_id,created_at) where session_id is not null;
create index events_member_time on public.events(member_id,created_at) where member_id is not null;
alter table public.users add column suspended_at timestamptz;
alter table public.admins add column manage_members boolean not null default false;
create table public.admin_member_audit (
  id bigint generated always as identity primary key, actor_id uuid not null, target_id uuid not null,
  action text not null, reason text not null, created_at timestamptz not null default now()
);
create index admin_member_audit_target on public.admin_member_audit(target_id,created_at);
create table public.analytics_start (started_at timestamptz not null default now());
insert into public.analytics_start default values;

-- A sole existing administrator is the initial operator. Multi-admin installations choose explicitly.
update public.admins set manage_members=true where (select count(*) from public.admins)=1;

create index events_oauth_attempt on public.events ((payload->>'attempt')) where type in ('login_succeeded','signup_completed');
create index events_oauth_flow on public.events ((payload->>'flow')) where type='oauth_started';
