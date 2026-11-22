create function public.card_fragment_signature(cards jsonb)
returns text language sql immutable strict parallel safe as $$
  select string_agg(lower(card->>'set') || ':' ||
    coalesce(public.normalize_collector_number(split_part(card->>'number', '/', 1)), card->>'number'), '/' order by
    lower(card->>'set'), public.normalize_collector_number(split_part(card->>'number', '/', 1)), card->>'number')
  from jsonb_array_elements(cards) as card;
$$;

alter table public.card_fragment_practice
  add column recent_questions text[] not null default '{}';

update public.card_fragment_practice r
set recent_questions = array[public.card_fragment_signature(p.cards)]
from public.card_fragment_puzzles p
where (p.day, p.game, p.stage) = (r.source_day, r.game, r.source_stage);
