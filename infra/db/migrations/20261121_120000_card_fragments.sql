create table public.card_fragment_puzzles (
  day date not null,
  game text not null check (game in ('name', 'odd')),
  cards jsonb not null,
  answer_slot smallint not null,
  aliases text[] not null default '{}',
  primary key (day, game)
);

create table public.card_fragment_images (
  day date not null,
  game text not null,
  slot smallint not null,
  frame text not null check (frame in ('close', 'wide', 'reveal')),
  image bytea not null,
  primary key (day, game, slot, frame),
  foreign key (day, game) references public.card_fragment_puzzles (day, game) on delete cascade
);

create table public.card_fragment_attempts (
  day date not null,
  game text not null,
  user_id uuid not null references public.users (id) on delete cascade,
  guesses smallint not null default 0 check (guesses between 0 and 2),
  used_hint boolean not null default false,
  solved boolean,
  choice smallint,
  primary key (day, game, user_id),
  foreign key (day, game) references public.card_fragment_puzzles (day, game)
);

create index card_fragment_attempts_user_game_idx
  on public.card_fragment_attempts (user_id, game, day);
