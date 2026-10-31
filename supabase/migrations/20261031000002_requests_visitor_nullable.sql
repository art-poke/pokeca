-- #4 회원 카드단위 요청은 visitor_id 없이 user_id로 기록한다. visitor_id를 nullable로.
-- (익명 규격별 "찾기요청"은 visitor_id, 회원 카드요청은 user_id — 둘 중 하나.)
alter table public.requests alter column visitor_id drop not null;
