alter table public.card_fragment_puzzles add column stage smallint not null default 1 check (stage > 0);
alter table public.card_fragment_images add column stage smallint not null default 1;
alter table public.card_fragment_attempts add column stage smallint not null default 1;

alter table public.card_fragment_images drop constraint card_fragment_images_day_game_fkey;
alter table public.card_fragment_attempts drop constraint card_fragment_attempts_day_game_fkey;
alter table public.card_fragment_puzzles drop constraint card_fragment_puzzles_pkey;
alter table public.card_fragment_puzzles add primary key (day, game, stage);

alter table public.card_fragment_images drop constraint card_fragment_images_pkey;
alter table public.card_fragment_images add primary key (day, game, stage, slot, frame);
alter table public.card_fragment_images add foreign key (day, game, stage)
  references public.card_fragment_puzzles (day, game, stage) on delete cascade;

alter table public.card_fragment_attempts drop constraint card_fragment_attempts_pkey;
alter table public.card_fragment_attempts add primary key (day, game, stage, user_id);
alter table public.card_fragment_attempts add foreign key (day, game, stage)
  references public.card_fragment_puzzles (day, game, stage);
