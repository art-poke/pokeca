-- Auth.js(NextAuth) Postgres 어댑터 스키마 — UUID 커스텀 버전.
-- 기본 @auth/pg-adapter는 users.id가 SERIAL(정수)이지만, 이 앱의 기존 FK들이
-- auth.users(id) = uuid 를 참조하므로 users.id를 uuid로 맞춘다(기존 스키마 호환).
-- 적용 순서: 이 파일 먼저 → 01_app.sql(앱 테이블, users FK 참조).

create extension if not exists "pgcrypto"; -- gen_random_uuid()

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text unique,
  "emailVerified" timestamptz,
  image text,
  -- 어드민 Credentials 로그인용 비밀번호 해시(bcrypt). 소셜 유저는 null.
  password_hash text,
  created_at timestamptz not null default now()
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references users (id) on delete cascade,
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  unique (provider, "providerAccountId")
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  "sessionToken" text not null unique,
  "userId" uuid not null references users (id) on delete cascade,
  expires timestamptz not null
);

create table if not exists verification_token (
  identifier text not null,
  token text not null,
  expires timestamptz not null,
  primary key (identifier, token)
);
