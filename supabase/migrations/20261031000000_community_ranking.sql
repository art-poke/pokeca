-- 커뮤니티·랭킹·도안 상세 고도화 에픽 (docs/designs/community-ranking-epic.md)
-- 일반 회원(member) · 추천/다운로드 점수(engagements) · 다형 댓글 · 게시판 · 도안 제목 · 회원 요청
-- 모든 테이블 RLS on·정책 없음. 서버 lib/supabase/server.ts의 db()(service_role)로만 접근.

-- #1 일반 회원: 비작가 소셜 유저 식별(닉네임). 첫 참여 시 서버가 소셜 이름으로 생성.
create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  created_at timestamptz not null default now()
);

-- #2 추천·다운로드 점수: (유저, 도안)당 1행 = 1점. 중복불가(다운로드 or 추천).
create table public.engagements (
  user_id uuid not null references auth.users (id) on delete cascade,
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  kind text not null check (kind in ('download', 'recommend')),
  created_at timestamptz not null default now(),
  primary key (user_id, artwork_id)
);
create index engagements_artwork on public.engagements (artwork_id, kind);
create index engagements_created on public.engagements (created_at);

-- #3/#5 다형 댓글 + 1단계 대댓글. 부모 댓글은 parent_id가 null.
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('artwork', 'post')),
  target_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null, -- 작성 시점 표시명 스냅샷(작가 display_name 또는 member nickname)
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index comments_target on public.comments (target_type, target_id, created_at);

-- #5 커뮤니티 게시판.
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  board text not null check (board in ('notice', 'suggestion', 'free')),
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index posts_board on public.posts (board, created_at desc);

-- #3 도안 제목(작가 입력, 기본 "{작가}님의 도안").
alter table public.artworks add column title text;

-- #4 회원 도안 요청. 카드 단위 요청(규격별 "찾기요청"과 분리). 유저당 카드당 1회.
alter table public.requests add column user_id uuid references auth.users (id) on delete cascade;
create unique index requests_card_user on public.requests (card_id, user_id) where user_id is not null;

-- RLS: 전부 켜고 정책 없음(= 익명/anon 접근 차단, 서버 service_role만).
alter table public.members enable row level security;
alter table public.engagements enable row level security;
alter table public.comments enable row level security;
alter table public.posts enable row level security;
