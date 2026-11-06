-- 일어판 gap 카드를 cards에 정식 편입 → 확장아트·검색·상세가 한글판과 똑같이 동작.
-- snkrdunk_cards(스테이징)에서 한글판에 없는 카드만 cards로. 재실행 안전(on conflict do nothing).

alter table public.cards add column if not exists lang text not null default 'ko';

-- cards.set_code → sets.code FK 충족: 일어판 세트를 sets에 추가(set_name을 이름으로).
insert into public.sets (code, name_ko)
select lower(s.set_code), min(coalesce(nullif(s.set_name, ''), s.set_code))
from public.snkrdunk_cards s
where s.set_code is not null
  and lower(s.set_code) not in (select lower(code) from public.sets)
group by lower(s.set_code)
on conflict (code) do nothing;

-- gap(한글판에 없는) 일어판 카드 → cards. 한글 검색 위해 species_ko를 이름 앞에 붙인다.
-- 같은 (set_code, 번호)로 여러 변형이 와도 distinct on으로 인기순 1장만.
insert into public.cards (set_code, collector_number, name_ko, rarity, image_path, lang)
select set_code, collector_number, name_ko, rarity, image_path, 'ja'
from (
  select distinct on (lower(s.set_code), s.collector_number || coalesce('/' || s.total, ''))
    lower(s.set_code) as set_code,
    s.collector_number || case when s.total is not null then '/' || s.total else '' end as collector_number,
    case when s.species_ko is not null then s.species_ko || ' ' || s.name_en else s.name_en end as name_ko,
    s.rarity, s.image_path
  from public.snkrdunk_cards s
  where coalesce(s.lang, 'ja') = 'ja' and s.set_code is not null and s.collector_number is not null
    and not exists (
      select 1 from public.cards c
      where lower(c.set_code) = lower(s.set_code)
        and public.normalize_collector_number(split_part(c.collector_number, '/', 1))
            = public.normalize_collector_number(s.collector_number))
  order by lower(s.set_code), s.collector_number || coalesce('/' || s.total, ''), s.popularity_rank nulls last
) q
on conflict (set_code, collector_number) do nothing;
