alter table public.card_fragment_puzzles
  add column answer_kind text not null default 'pokemon'
  check (answer_kind = 'pokemon' or (answer_kind = 'trainer' and game = 'name'));

alter table public.card_fragment_puzzles
  add column bank_only boolean not null default false;
