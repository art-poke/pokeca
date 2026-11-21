-- 첫 방문만 저장해 같은 브라우저의 새로고침과 재방문을 중복 집계하지 않는다.
create table public.story_views (
  story_id uuid not null,
  visitor_id uuid not null,
  primary key (story_id, visitor_id)
);
