alter table public.card_fragment_attempts
  add column started_at timestamptz,
  add column timed_out boolean not null default false;

alter table public.card_fragment_practice
  add column started_at timestamptz,
  add column timed_out boolean not null default false;
