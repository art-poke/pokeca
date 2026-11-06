-- 프로필 확장: 링크 여러 개(오픈카톡/기타) + 활동처·닉네임 여러 개. email/intro는 기존 컬럼 사용.
alter table public.artists add column if not exists links jsonb not null default '[]'::jsonb;
alter table public.artists add column if not exists activities jsonb not null default '[]'::jsonb;
