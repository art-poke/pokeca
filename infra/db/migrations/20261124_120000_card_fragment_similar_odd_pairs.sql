alter table public.card_fragment_puzzles add column similar_odd_pair boolean not null default false;

-- Curated families and lookalikes. Both directions are playable when each species has two artworks.
with groups(names) as (
  values
    (array['피카츄','피츄','라이츄','데덴네']),
    (array['이상해씨','이상해풀','이상해꽃']),
    (array['치코리타','베이리프','메가니움']),
    (array['파이리','리자드','리자몽']),
    (array['브케인','마그케인','블레이범']),
    (array['꼬부기','어니부기','거북왕']),
    (array['리아코','엘리게이','장크로다일']),
    (array['미뇽','신뇽','망나뇽']),
    (array['팬텀','고우스트','고오스']),
    (array['치릴리','드레디어']),
    (array['라우드본','악뜨거','뜨아거']),
    (array['삐','삐삐','픽시','푸린','푸푸린']),
    (array['럭키','해피너스']),
    (array['누오','우파']),
    (array['고라파덕','골덕']),
    (array['이브이','부스터','쥬피썬더']),
    (array['샤미드','글레이시아']),
    (array['루카리오','리오르']),
    (array['가디안','킬리아','랄토스']),
    (array['코일','레어코일','자포코일']),
    (array['애버라스','데기라스','마기라스']),
    (array['아라리','나시']),
    (array['로토무','에몽가']),
    (array['야돈','야도란','야도킹']),
    (array['나옹','페르시온']),
    (array['오타치','다꼬리'])
), pairings as (
  select distinct same_species, odd_species
  from groups cross join lateral unnest(names) same_species cross join lateral unnest(names) odd_species
  where same_species <> odd_species
), cards as (
  select distinct on (card->>'name', card->'cropSource'->>'id')
    card->>'name' as species, card->'cropSource'->>'id' as image_id, card
  from public.card_fragment_puzzles p cross join lateral jsonb_array_elements(p.cards) card
  where p.answer_kind = 'pokemon' and p.has_runtime_crop and card ? 'cropSource'
  order by card->>'name', card->'cropSource'->>'id', (card ? 'cameo') desc, p.day
), candidates as (
  select m.same_species, m.odd_species, assembled.cards, public.card_fragment_signature(assembled.cards) as signature
  from pairings m
  join cards a on a.species = m.same_species
  join cards b on b.species = m.same_species and b.image_id > a.image_id
  join cards c on c.species = m.odd_species
  cross join lateral (select jsonb_build_array(a.card, b.card, c.card) as cards) assembled
), numbered as (
  select distinct on (signature) *, row_number() over (partition by same_species, odd_species order by md5(signature)) as variation
  from candidates
  order by signature, same_species, odd_species
), combinations as (
  select cards, signature, row_number() over (order by signature)::int as sequence
  from numbered where variation <= 5
)
insert into public.card_fragment_puzzles (day, game, stage, cards, answer_slot, aliases, bank_only, answer_kind, similar_odd_pair)
select '2095-01-01'::date + sequence, 'odd', 1, cards, 2, '{}', true, 'pokemon', true
from combinations;

-- Give previously authored versions of the same combinations the same priority.
update public.card_fragment_puzzles p
set similar_odd_pair = true
where p.game = 'odd' and not p.similar_odd_pair and exists (
  select 1 from public.card_fragment_puzzles matched
  where matched.game = 'odd' and matched.similar_odd_pair and matched.rotation_signature = p.rotation_signature
);
