-- #4 회원 카드단위 요청: format 없이(카드 전체) 요청 가능하게.
alter table public.requests alter column format drop not null;

-- #3 도안 제목 기본 백필: 기존 도안은 "{작가}님의 도안".
update public.artworks set title = artist_name || '님의 도안' where title is null;
