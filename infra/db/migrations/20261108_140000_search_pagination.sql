-- 카드 검색 함수에 limit/offset 추가(무한스크롤 서버 페이지네이션).
-- 본문·정렬·card_hit 반환 타입은 기존과 동일. 끝의 limit 50 → limit/offset.
drop function if exists public.search_cards_by_number(text, text, text);
create function public.search_cards_by_number(
  p_set text, p_number text, p_total text,
  p_limit int default 20, p_offset int default 0
)
returns setof public.card_hit
language sql
stable
set search_path = ''
as $$
  with matched as (
    select c.id as card_id, null::text as alias_lang, null::text as alias_set_code,
           null::text as alias_number
    from public.cards c
    where (p_set is null or lower(c.set_code) = lower(p_set))
      and public.normalize_collector_number(split_part(c.collector_number, '/', 1)) = p_number
      and (p_total is null
           or public.normalize_collector_number(split_part(c.collector_number, '/', 2)) = p_total)
    union all
    select a.card_id, a.lang, a.set_code, a.collector_number
    from public.card_aliases a
    where (p_set is null or lower(a.set_code) = lower(p_set))
      and public.normalize_collector_number(split_part(a.collector_number, '/', 1)) = p_number
      and (p_total is null
           or public.normalize_collector_number(split_part(a.collector_number, '/', 2)) = p_total)
  ),
  -- 같은 카드가 정본과 별칭으로 둘 다 맞으면 정본 쪽을 남긴다.
  best as (
    select distinct on (card_id) *
    from matched
    order by card_id, alias_lang nulls first
  )
  select c.id, c.set_code, c.collector_number, c.name_ko, c.rarity, s.name_ko, s.released_on,
         (select count(*)::int from public.artworks w
           where w.card_id = c.id and w.status = 'active'),
         b.alias_lang, b.alias_set_code, b.alias_number
  from best b
  join public.cards c on c.id = b.card_id
  join public.sets s on s.code = c.set_code
  order by 8 desc, s.released_on desc nulls last, c.collector_number
  limit p_limit offset p_offset
$$;

drop function if exists public.search_cards_by_name(text);
create function public.search_cards_by_name(
  p_text text, p_limit int default 20, p_offset int default 0
)
returns setof public.card_hit
language sql
stable
set search_path = ''
as $$
  with matched as (
    select c.id as card_id,
           public.similarity(c.name_ko, p_text) as score
    from public.cards c
    where c.name_ko operator(public.%) p_text or c.name_ko ilike '%' || p_text || '%'
    union all
    select a.card_id, public.similarity(a.name, p_text)
    from public.card_aliases a
    where a.name operator(public.%) p_text or a.name ilike '%' || p_text || '%'
  ),
  best as (
    select card_id, max(score) as score from matched group by card_id
  )
  select c.id, c.set_code, c.collector_number, c.name_ko, c.rarity, s.name_ko, s.released_on,
         (select count(*)::int from public.artworks w
           where w.card_id = c.id and w.status = 'active'),
         null::text, null::text, null::text
  from best b
  join public.cards c on c.id = b.card_id
  join public.sets s on s.code = c.set_code
  order by 8 desc, b.score desc, s.released_on desc nulls last, c.collector_number
  limit p_limit offset p_offset
$$;
