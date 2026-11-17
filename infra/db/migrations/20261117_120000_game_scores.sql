-- 몬스터볼 수박게임 점수 (domains/game). 역대 최고(유저별 MAX) + 월별(played_at 기준) 리더보드용.
-- played_at은 서버 insert 시각으로 설정한다(월 버킷 키이자 검증 대상 — 클라이언트 값 신뢰 금지).
-- balls_placed/max_tier/duration_ms는 가벼운 검증·표시용 통계.
create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  score bigint not null,
  balls_placed smallint not null,
  max_tier smallint not null,
  duration_ms bigint not null,
  played_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 리더보드 정렬/필터 인덱스.
create index if not exists game_scores_score_idx on public.game_scores (score desc);
create index if not exists game_scores_played_at_idx on public.game_scores (played_at);
create index if not exists game_scores_user_idx on public.game_scores (user_id);
