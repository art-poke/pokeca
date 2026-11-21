alter table public.comments drop constraint comments_target_type_check;
alter table public.comments add constraint comments_target_type_check
  check (target_type in ('artwork', 'post', 'story'));

-- 편집 글의 ID는 저장소의 글 데이터에서 관리한다.
create table public.story_likes (
  story_id uuid not null,
  user_id uuid not null references public.users(id) on delete cascade,
  primary key (story_id, user_id)
);
