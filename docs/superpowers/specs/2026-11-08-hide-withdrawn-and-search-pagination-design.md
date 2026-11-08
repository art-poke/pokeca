# 탈퇴 작가 숨김 & 카드검색 서버 페이지네이션 설계

> 작성: 2026-11-08. 상태: 설계(구현 전). 연관: 진행 중인 회원 탈퇴 기능(`lib/artists.ts::withdrawMyAccount`, `artists.deletedAt`, `infra/db/migrations/20261108_120000_artist_deleted_at.sql` — 모두 커밋 전), `lib/ranking.ts`, `lib/cards.ts`.

두 개의 독립 기능을 한 라운드로 다룬다.
1. **탈퇴 작가 숨김** — 탈퇴한 작가와 그 작품을 공개 지면(랭킹·카드상세·검색 카운트)에서 제외.
2. **카드검색 서버 페이지네이션** — 검색 결과를 20개씩 서버에서 받아 무한스크롤.

---

## 기능 1 — 탈퇴 작가 숨김

### 배경 / 문제

오늘 회원 탈퇴(소프트)가 추가됐다(커밋 전). `withdrawMyAccount`는 `artists.deletedAt`를 찍고 PII를 익명화(`display_name='탈퇴한 작가'`, `handle=null`)하고 OAuth를 언링크한다. 코드 주석은 "작품은 handle=null이라 공개 지면에서 자동 제외된다"고 적혀 있으나 **이는 작가 프로필 페이지에만 해당**한다. 작품 레코드는 `status='active'`로 그대로 남아:

- **작가 랭킹**(`lib/ranking.ts::artistRanking`)에 탈퇴 작가가 계속 노출된다 ← 신고된 증상.
- **작품 랭킹**(`artworkRanking`)에 탈퇴 작가의 작품이 노출된다.
- **카드 상세**(`lib/artworks.ts::listPublicArtworks`)에 작품이 계속 뜬다.
- **검색 결과의 `artwork_count`**(stored proc `active` 카운트)가 탈퇴 작품까지 센다.

### 핵심 관찰

모든 공개 조회가 이미 **`artworks.status='active'`만** 본다. `status`는 `active` / `hidden`(본인만 비공개) / `withdrawn`(내림, **복구 불가**) 3값이고, 개별 작품 내림(`withdrawMyArtwork`)이 이미 `withdrawn`을 쓴다.

### 결정: 탈퇴 시 작품을 `withdrawn`으로 내린다

읽기 경로 여러 곳에 `deletedAt IS NULL` 필터를 뿌리는 대신, **쓰기 경로 한 곳**(탈퇴)에서 작품 status를 내려 기존 `status='active'` 필터에 올라탄다.

- `withdrawMyAccount` 트랜잭션에 추가: 해당 작가의 `active`/`hidden` 작품을 전부 `status='withdrawn'`으로 업데이트.
  - → 작가랭킹·작품랭킹·카드상세·검색 `artwork_count`·둘러보기·오타제안이 **전부 자동 제외**된다(추가 쿼리 수정 없음).
  - 트랜잭션 안에서 실행해 PII 익명화와 원자적으로 커밋된다.
  - **주의 — `artwork_set_status` 우회**: 개별 작품 내림(`withdrawMyArtwork`)은 plpgsql `artwork_set_status`를 거쳐 `consent_events` 감사로그를 남기고 파일 purge 경로를 계산한다. 탈퇴 시 벌크 `UPDATE`는 이를 우회한다. 계정 탈퇴는 작품 단위와 다른 감사 맥락이고 파일 정리는 별도로 돌릴 수 있어 **우회해도 무방하다고 보지만**, 구현 계획에서 (ㄱ) 탈퇴 작품도 consent 로깅/파일 purge를 태울지, (ㄴ) 단순 벌크 UPDATE로 갈지 **명시적으로 결정**한다. 권장: 이번 라운드는 단순 벌크 UPDATE(공개 숨김이 목적), 파일 purge는 후속.
- **일회성 백필 마이그레이션**: 이미 탈퇴됐는데(= `deleted_at IS NOT NULL`) 작품이 아직 `active`/`hidden`인 경우를 한 번 내린다. 멱등.
  ```sql
  update public.artworks w
     set status = 'withdrawn'
   from public.artists a
   where w.artist_id = a.user_id
     and a.deleted_at is not null
     and w.status in ('active','hidden');
  ```
  - 탈퇴 기능이 방금 추가돼 실데이터엔 대상이 없을 수 있으나(사실상 no-op 가능), 시드/데모 데이터와의 정합성 및 방어를 위해 포함.

### 의미 / 짚을 점 (승인됨)

`withdrawn`은 "복구 불가"로 정의돼 있다. 계정 탈퇴도 OAuth 언링크로 **복구 불가**(재로그인=새 계정)이므로 의미가 일치한다. 즉 **"탈퇴 = 작품도 영구히 내려감"**. 사용자가 요청한 "작품도 숨김"과 부합한다.

### 비목표 (YAGNI)

- 탈퇴 복구(un-withdraw) 기능 — 탈퇴 자체가 비가역이므로 범위 밖.
- `active`/`hidden` 외 상태 추가(예: `account_withdrawn` 별도 상태) — 구분 실익 없음. 작가 단위 추적이 필요하면 `artists.deletedAt`로 충분.

### 테스트

- 유닛: `withdrawMyAccount` 후 그 작가의 작품이 전부 `withdrawn`인지. 다른 작가 작품은 불변인지.
- 유닛/통합: 탈퇴 작가가 `artistRanking`·`artworkRanking` 결과에서 사라지는지. `listPublicArtworks`에서 빠지는지.
- 백필: 실행 후 `deleted_at` 있는 작가의 잔여 `active`/`hidden` 작품이 0인지. 재실행해도 동일(멱등).

---

## 기능 2 — 카드검색 서버 페이지네이션 무한스크롤

### 배경 / 문제

`lib/cards.ts::searchCards(query)`가 매칭 결과를 **한 번에 전부**(현재 두 stored proc 모두 `LIMIT 50` 고정) 가져온다. `app/search/page.tsx`(서버 컴포넌트)가 그 최대 50개를 한 격자에 렌더하고, **그 이상은 아예 볼 수 없다**(페이지네이션 부재 = 무한스크롤 요구의 핵심 동기).

이미지는 이미 `<img loading="lazy">`라 화면 밖 이미지는 지금도 한꺼번에 받지 않는다. 남는 비용은 **(a) 검색 함수 실행·행 전송·2차 이미지경로 조회가 결과 개수에 비례**(특히 번호검색 무제한), **(b) 초기 DOM에 전체 타일 생성**. 서버 페이지네이션으로 둘 다 20개분으로 줄인다.

### DB (stored proc) — `infra/db/migrations/` 새 마이그레이션

`create or replace function`으로 두 검색 함수에 `limit`/`offset`을 추가한다.

- `search_cards_by_name(p_text text, p_limit int, p_offset int)` — 기존 하드코딩 `limit 50` → `limit p_limit offset p_offset`.
- `search_cards_by_number(p_set text, p_number text, p_total text, p_limit int, p_offset int)` — 기존 `limit 50` → `limit p_limit offset p_offset`. 현재 `cards ∪ card_aliases` UNION 결과를 서브쿼리로 감싸고 기존 `order by` 유지한 뒤 `limit/offset`.
- 정렬은 기존 그대로(이름: 작품수 desc, 관련도 desc, 발매일 desc / 번호: 발매일 desc, collector_number) — 결정적이라 offset 안정적.
- 함수 시그니처가 바뀌므로 기존 호출부(`lib/cards.ts`)를 함께 갱신. 다른 호출부(`cardCandidates`)도 새 시그니처로.

### 데이터 계층 (`lib/cards.ts`)

- `searchCards(query, opts?: { limit?: number; offset?: number })` → `{ parsed, hits, hasMore }`.
  - 기본 `limit = 20`, `offset = 0`.
  - `hasMore`는 **`limit+1`개 요청** 후 넘치면 true로 판정하고 초과분 1개를 버린다(별도 count 쿼리 없음).
  - `withImagePaths`는 페이지당 20개에만 적용.
- 반환 타입에 `hasMore` 추가. 기존 `SearchResult` 사용처(단건 리다이렉트·0건 제안)는 1페이지 응답으로 그대로 동작.

### API 라우트 (2페이지부터 클라 호출)

- `GET /api/search?q=<query>&offset=<n>` → `{ hits, hasMore }` (JSON).
- 서버에서 `searchCards(q, { offset, limit: 20 })` 호출. `recordSearch` 계측은 1페이지(SSR)에서만 수행하고 추가 페이지에선 하지 않는다(중복 집계 방지).

### 프론트 — 하이브리드 SSR + 클라

- **1페이지는 서버 렌더 유지**(`app/search/page.tsx`): 첫 화면 빠름 + 다음 로직 보존.
  - "결과가 정확히 1개(그리고 `hasMore=false`)면 카드 상세로 즉시 리다이렉트."
  - "0개면 오타 제안(`suggestCards`)."
- **2페이지부터 클라**: 결과 격자를 클라이언트 컴포넌트(`SearchResults`)로 분리.
  - `useInfiniteQuery`(react-query v5, 설치됨): `queryKey: ['search', q]`, `initialData`에 **SSR 1페이지 주입**, `getNextPageParam: (last) => last.hasMore ? nextOffset : undefined`.
  - 바닥 **IntersectionObserver 센티넬**이 보이면 `fetchNextPage`. 로딩 중 스피너/스켈레톤.
  - 페이지 크기 **20**.
- 이미지는 현 `<img loading="lazy">` 유지.
- 훅/쿼리키 위치: 검색 전용 코로케이션(`app/search/use-search.ts` 또는 `domains/card-search/hooks.ts`) — 구현 계획에서 기존 `domains/card-request/hooks.ts`의 쿼리키 팩토리 패턴에 맞춰 확정.

### 방식 선택

offset 페이지네이션(정렬이 결정적이라 충분). 데이터가 수천 건+로 커지면 cursor로 승급 — 지금은 가오픈·소량이라 YAGNI.

### 비목표 (YAGNI)

- cursor 기반 페이지네이션.
- 검색 결과 total count 표시(=별도 count 쿼리). `hasMore`만으로 무한스크롤 충분.
- 검색 외 다른 목록(카드상세 작품 목록 등)의 페이지네이션 — 이번 범위 밖.

### 테스트

- DB: `search_cards_by_name/by_number`가 limit/offset을 올바로 적용(1페이지와 2페이지가 겹치지 않고, 이어지는지).
- 데이터 계층: `hasMore` 판정(정확히 `limit`개면 false, `limit+1` 매칭이면 true).
- 프론트: 1페이지 SSR 렌더 → 스크롤 시 2페이지 append. 단건 리다이렉트·0건 제안 회귀.

---

## 구현 순서 (제안)

1. 기능 1 — `withdrawMyAccount` 작품 내림 + 백필 마이그레이션 + 테스트. (소규모, 진행 중 탈퇴 작업의 직접 연장)
2. 기능 2 — stored proc 마이그레이션 → `lib/cards.ts` → API 라우트 → 프론트 하이브리드 → 테스트.

두 기능은 독립적이라 순서는 바뀌어도 무방.

## 열린 질문

- 검색 훅/쿼리키 배치 위치(코로케이션 vs `domains/card-search/`) — 구현 계획에서 확정.
- 백필 마이그레이션을 별도 파일로 둘지, 기능 1 작품-내림 로직과 같은 PR 범위로 묶을지(묶는 것을 권장).
