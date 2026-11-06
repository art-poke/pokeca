-- SNKRDUNK 일어판 카드 카탈로그(인기순 수집). 기존 한글판 cards와 분리 —
-- cards를 공유하면 한글 검색/둘러보기 함수에 일어판이 섞여 오염되므로 별도 테이블로 둔다.
-- 검색에선 (set_code, collector_number)로 cards와 조인해 겹치면 한글판 우선, 없으면 일어판을 gap으로 노출.
create table if not exists public.snkrdunk_cards (
  id uuid primary key default gen_random_uuid(),
  source_id text not null unique,        -- SNKRDUNK trading-card id
  species text,                          -- 수집 키워드(영문명)
  species_ko text,                       -- 한글 검색용 이름(targets.json의 ko)
  name_en text not null,                 -- 목록 원문 이름부(레어도 포함)
  rarity text,                           -- 추정 레어도(SAR/SR/AR/UR…)
  set_code text,                         -- 세트코드(SV2a, M6a, SM-P…)
  collector_number text,                 -- 번호(137)
  total text,                            -- 총수(103), 없을 수 있음
  set_name text,                         -- 세트명(원문)
  lang text,                             -- ja(일본판) / en(영문판)
  price_krw bigint,                      -- 최저가(참고용)
  popularity_rank int,                   -- 해당 키워드 내 인기순위(수집 순서)
  image_path text,                       -- 이미지 키({source_id}.webp)
  source_url text,
  raw_title text,                        -- 파싱 실패 대비 원문
  fetched_at timestamptz not null default now()
);
create index if not exists snkrdunk_cards_species on public.snkrdunk_cards (species);
create index if not exists snkrdunk_cards_species_ko on public.snkrdunk_cards (species_ko);
create index if not exists snkrdunk_cards_setnum on public.snkrdunk_cards (set_code, collector_number);
