-- 작가 후기: 회원이 작가에게 남기는 이미지+텍스트 후기.
-- 작가 공개페이지·작가 스튜디오·커뮤니티 "작가 후기"에서 함께 보인다.
create table public.artist_reviews (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists (user_id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade, -- 작성 회원
  author_name text not null, -- 작성 시점 표시명 스냅샷
  body text not null,
  image_path text, -- 선택 이미지(artworks 버킷 reviews/<uploadId>)
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index artist_reviews_artist on public.artist_reviews (artist_id, created_at desc);
create index artist_reviews_recent on public.artist_reviews (created_at desc) where deleted_at is null;

-- RLS: 켜고 정책 없음(= anon 차단, 서버 service_role만).
alter table public.artist_reviews enable row level security;
