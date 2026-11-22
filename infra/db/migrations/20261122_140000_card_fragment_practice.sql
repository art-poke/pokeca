create table public.card_fragment_practice (
  user_id uuid not null references public.users (id) on delete cascade,
  game text not null check (game in ('name', 'odd')),
  run_id uuid not null,
  day date not null,
  round integer not null check (round > 0),
  source_day date not null,
  source_stage integer not null,
  guesses smallint not null default 0,
  used_hint boolean not null default false,
  solved boolean,
  choice smallint,
  primary key (user_id, game),
  foreign key (source_day, game, source_stage)
    references public.card_fragment_puzzles (day, game, stage) on delete cascade
);
