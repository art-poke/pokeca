-- 마이프로필: 회원 프로필 이미지 + 카드 즐겨찾기.
-- members.avatar_path: 회원이 올린 프로필 이미지 경로(artworks 버킷 avatars/<userId>/<uploadId>). 없으면 이니셜.
alter table public.members add column avatar_path text;

-- 카드 즐겨찾기: (회원, 카드)당 1행. 마이프로필에서 모아 본다.
create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, card_id)
);
create index favorites_user on public.favorites (user_id, created_at desc);

-- RLS: 켜고 정책 없음(= anon 차단, 서버 service_role만). members/engagements와 동일.
alter table public.favorites enable row level security;
