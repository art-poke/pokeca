-- #4 개선: 요청을 규격별로(9포켓/PSA/BRG) 받고, 작가가 그 규격 도안을 올리면 해결 처리.
-- 해결된 요청은 요청방 목록에서 내려가고, 누가 해결했는지(resolved_by)로 작가 프로필에 집계.

alter table public.requests add column resolved_at timestamptz;
alter table public.requests add column resolved_by uuid references auth.users (id);

-- 회원은 카드×규격당 1회 요청(기존 card×user 유니크를 규격 포함으로 교체).
drop index if exists public.requests_card_user;
create unique index requests_card_user_format
  on public.requests (card_id, user_id, format) where user_id is not null;

create index requests_open on public.requests (card_id, format) where resolved_at is null;
create index requests_resolved_by on public.requests (resolved_by) where resolved_by is not null;
