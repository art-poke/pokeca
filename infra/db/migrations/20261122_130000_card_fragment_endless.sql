alter table public.card_fragment_images drop constraint card_fragment_images_day_game_stage_fkey;
alter table public.card_fragment_attempts drop constraint card_fragment_attempts_day_game_stage_fkey;

alter table public.card_fragment_puzzles alter column stage type integer;
alter table public.card_fragment_images alter column stage type integer;
alter table public.card_fragment_attempts alter column stage type integer;

alter table public.card_fragment_images add foreign key (day, game, stage)
  references public.card_fragment_puzzles (day, game, stage) on delete cascade;
alter table public.card_fragment_attempts add foreign key (day, game, stage)
  references public.card_fragment_puzzles (day, game, stage);
