alter table public.card_fragment_puzzles
  add column rotation_signature text generated always as (public.card_fragment_signature(cards)) stored,
  add column has_cameo boolean generated always as (jsonb_path_exists(cards, '$[*].cameo')) stored,
  add column has_runtime_crop boolean generated always as ((cards->0) ? 'cropSource') stored;
