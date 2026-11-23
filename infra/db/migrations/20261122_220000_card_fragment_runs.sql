-- Add a new active state table so the previous app continues to work during deployment.
create table public.card_fragment_active_runs (like public.card_fragment_practice including all);
alter table public.card_fragment_active_runs
  add foreign key (user_id) references public.users(id) on delete cascade,
  add foreign key (source_day, game, source_stage)
    references public.card_fragment_puzzles(day, game, stage) on delete cascade;

create table public.card_fragment_run_scores (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  game text not null check (game in ('name', 'odd')),
  day date not null,
  wins integer not null default 0,
  stars integer not null default 0 check (stars between 0 and wins),
  finished boolean not null default false
);
create index card_fragment_run_scores_month_idx on public.card_fragment_run_scores(game, day, user_id);
create index card_fragment_run_scores_player_idx on public.card_fragment_run_scores(user_id, game, day);

create table public.card_fragment_source_images (
  id text primary key,
  image bytea not null
);
