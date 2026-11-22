-- The yellow Pikachu mark on these 30th CELEBRATION prints is the set logo.
update public.card_fragment_puzzles p
set cards = (
  select jsonb_agg(
    case when lower(c.card->>'set') = 'm6a'
      and c.card->>'number' in ('105/103','106/103','107/103','108/103','112/103','121/103')
      and c.card->>'cameo' = '피카츄'
    then c.card - 'cameo' else c.card end
    order by c.position
  )
  from jsonb_array_elements(p.cards) with ordinality as c(card, position)
)
where exists (
  select 1 from jsonb_array_elements(p.cards) as card
  where lower(card->>'set') = 'm6a'
    and card->>'number' in ('105/103','106/103','107/103','108/103','112/103','121/103')
    and card->>'cameo' = '피카츄'
);
