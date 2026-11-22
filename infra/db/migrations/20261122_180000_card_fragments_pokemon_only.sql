-- Keep recorded scores when replacing questions that were already assigned.
create temporary table fragment_pokemon_replacements on commit drop as
select trainer.day, trainer.game, trainer.stage, pick.day as source_day, pick.stage as source_stage
from public.card_fragment_puzzles trainer
cross join lateral (
  select day, stage
  from public.card_fragment_puzzles
  where game = trainer.game and answer_kind = 'pokemon' and stage <= 3
  order by (day = trainer.day), md5(concat(trainer.day, '/', trainer.stage, '/', day, '/', stage))
  limit 1
) pick
where trainer.answer_kind = 'trainer' and not trainer.bank_only;

delete from public.card_fragment_images i
using fragment_pokemon_replacements r
where (i.day, i.game, i.stage) = (r.day, r.game, r.stage);

insert into public.card_fragment_images (day, game, stage, slot, frame, variant, image)
select r.day, r.game, r.stage, i.slot, i.frame, i.variant, i.image
from fragment_pokemon_replacements r
join public.card_fragment_images i on (i.day, i.game, i.stage) = (r.source_day, r.game, r.source_stage);

update public.card_fragment_attempts a
set guesses = 0, used_hint = false, choice = null, started_at = null, timed_out = false
from fragment_pokemon_replacements r
where (a.day, a.game, a.stage) = (r.day, r.game, r.stage) and a.solved is null;

delete from public.card_fragment_practice r
using public.card_fragment_puzzles p
where (p.day, p.game, p.stage) = (r.source_day, r.game, r.source_stage) and p.answer_kind = 'trainer';

update public.card_fragment_puzzles p
set cards = source.cards, aliases = source.aliases, answer_slot = source.answer_slot, answer_kind = 'pokemon'
from fragment_pokemon_replacements r
join public.card_fragment_puzzles source on (source.day, source.game, source.stage) = (r.source_day, r.game, r.source_stage)
where (p.day, p.game, p.stage) = (r.day, r.game, r.stage);

delete from public.card_fragment_puzzles p
where p.answer_kind = 'trainer' and p.bank_only
  and not exists (select 1 from public.card_fragment_attempts a where (a.day, a.game, a.stage) = (p.day, p.game, p.stage));
