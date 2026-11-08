# 탈퇴 작가 숨김 & 카드검색 서버 페이지네이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) 탈퇴한 작가와 그 작품을 공개 지면에서 제외하고, (2) 카드검색을 서버 페이지네이션 기반 무한스크롤로 바꾼다.

**Architecture:**
- 기능1 — 탈퇴 시 그 작가 작품을 `status='withdrawn'`으로 내려, 이미 모든 공개 조회에 깔린 `status='active'` 필터에 올라타 자동 제외시킨다(읽기 경로 수정 없음). 과거 탈퇴자용 일회성 백필 마이그레이션 포함.
- 기능2 — stored proc 2개에 `limit/offset` 추가 → `lib/cards.ts`가 `hasMore` 계산 → `/api/search` 라우트 → 1페이지 SSR + 이후 `useInfiniteQuery`+IntersectionObserver 하이브리드.

**Tech Stack:** Next.js 16(App Router), drizzle-orm, PostgreSQL(plpgsql stored procs), @tanstack/react-query v5, vitest(통합테스트, 로컬 Docker PG).

**연관 문서:** 스펙 `docs/superpowers/specs/2026-11-08-hide-withdrawn-and-search-pagination-design.md`

**사전조건(테스트 실행):** 로컬 Docker Postgres 5432 기동(`docker-compose up -d`) + `DATABASE_URL`(.env.local) + `npm run db:migrate` 적용 상태. 통합테스트는 `npm run test`(vitest).

**브랜치:** 현재 pokeca 작업트리(`feat/image-rendering-strategy`)에 **진행 중인 탈퇴 기능이 커밋 전 상태**로 있다(이 작업의 전제). 기능1은 그 위에 얹는다. 작업 시작 전 선택적으로 전용 브랜치를 따되, 커밋 전 변경을 함께 가져가야 한다.

---

## 파일 구조

**기능1 (탈퇴 숨김)**
- Modify: `lib/artists.ts` — `withdrawMyAccount` 트랜잭션에 작품 벌크 내림 추가
- Create: `infra/db/migrations/20261108_130000_withdraw_hide_artworks.sql` — 과거 탈퇴자 백필
- Create: `tests/integration/withdraw-hide.test.ts` — 탈퇴→작품 withdrawn + 랭킹/상세 제외 검증

**기능2 (검색 페이지네이션)**
- Create: `infra/db/migrations/20261108_140000_search_pagination.sql` — 검색 함수 2개 limit/offset
- Modify: `lib/cards.ts` — `searchCards(query, opts)` → `{ parsed, hits, hasMore }`, `cardCandidates` limit 보정
- Create: `app/api/search/route.ts` — GET 페이지 조회
- Create: `domains/card-search/api/endpoints.ts` · `api/queries.ts` · `api/types.ts`
- Create: `domains/card-search/hooks.ts` — `useCardSearchInfinite`
- Create: `components/search-results.tsx` — 클라 격자 + IntersectionObserver 센티넬
- Modify: `app/search/page.tsx` — 1페이지 SSR + `<SearchResults>` 위임, 단건 리다이렉트 조건 보정
- Modify: `tests/integration/cards-search.test.ts` — limit/offset·hasMore 케이스 추가

두 기능은 독립적이다. PART A → PART B 순서 권장(A가 작고 진행 중 작업의 직접 연장).

---

# PART A — 탈퇴 작가 숨김

REQUIRED SKILL: @superpowers:test-driven-development

### Task A1: 탈퇴 시 그 작가의 작품을 `withdrawn`으로 내린다

**Files:**
- Test: `tests/integration/withdraw-hide.test.ts` (생성)
- Modify: `lib/artists.ts` (`withdrawMyAccount`, 현재 ~523행)

- [ ] **Step 1: 실패 테스트 작성**

`tests/integration/withdraw-hide.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { artists, artworks, cards, engagements, sets, users } from "@/lib/db/schema";
import { withdrawMyAccount, type Artist } from "@/lib/artists";
import { artistRanking, artworkRanking } from "@/lib/ranking";
import { listPublicArtworks } from "@/lib/artworks";

// 로컬 Docker Postgres(5432)에 직접 행을 넣고 탈퇴 동작을 검증한다. 끝나면 지운다.
const TAG = `whd${Date.now()}`;
const SET_CODE = `${TAG}set`;

let cardId: string;
let userId: string;
let artActive: string;
let artHidden: string;

beforeAll(async () => {
  await db.insert(sets).values({ code: SET_CODE, nameKo: `${TAG} 세트` });
  [{ id: cardId }] = await db
    .insert(cards)
    .values({ setCode: SET_CODE, collectorNumber: "201/165", nameKo: `${TAG} 리자몽 ex` })
    .returning({ id: cards.id });

  [{ id: userId }] = await db
    .insert(users)
    .values({ email: `${TAG}@example.com` })
    .returning({ id: users.id });
  await db.insert(artists).values({ userId, displayName: `${TAG} 작가`, provider: "google" });

  [{ id: artActive }, { id: artHidden }] = await db
    .insert(artworks)
    .values([
      { cardId, artistId: userId, artistName: `${TAG} 작가`, format: "9pocket", status: "active" },
      { cardId, artistId: userId, artistName: `${TAG} 작가`, format: "9pocket", status: "hidden" },
    ])
    .returning({ id: artworks.id });

  // active 도안에 추천 1 → 탈퇴 전엔 작가/작품 랭킹에 잡혀야 한다.
  await db.insert(engagements).values({ userId, artworkId: artActive, kind: "recommend" });
});

afterAll(async () => {
  await db.delete(engagements).where(eq(engagements.userId, userId));
  await db.delete(artworks).where(inArray(artworks.id, [artActive, artHidden]));
  await db.delete(artists).where(eq(artists.userId, userId));
  await db.delete(cards).where(eq(cards.id, cardId));
  await db.delete(sets).where(eq(sets.code, SET_CODE));
  await db.delete(users).where(eq(users.id, userId));
});

describe("withdrawMyAccount — 작품 숨김", () => {
  it("탈퇴 전엔 작가/작품 랭킹·카드상세에 보인다", async () => {
    expect((await artistRanking("all", 100)).some((e) => e.userId === userId)).toBe(true);
    expect((await artworkRanking("all", 100)).some((e) => e.artworkId === artActive)).toBe(true);
    expect((await listPublicArtworks(cardId)).some((a) => a.id === artActive)).toBe(true);
  });

  it("탈퇴하면 그 작가의 active/hidden 작품이 전부 withdrawn이 된다", async () => {
    // withdrawMyAccount는 artist.userId / artist.avatarPath만 읽는다.
    await withdrawMyAccount({ userId, avatarPath: null } as Artist);

    const rows = await db
      .select({ status: artworks.status })
      .from(artworks)
      .where(inArray(artworks.id, [artActive, artHidden]));
    expect(rows.every((r) => r.status === "withdrawn")).toBe(true);
  });

  it("탈퇴 후엔 작가/작품 랭킹·카드상세에서 사라진다", async () => {
    expect((await artistRanking("all", 100)).some((e) => e.userId === userId)).toBe(false);
    expect((await artworkRanking("all", 100)).some((e) => e.artworkId === artActive)).toBe(false);
    expect((await listPublicArtworks(cardId)).length).toBe(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- withdraw-hide`
Expected: FAIL — 두 번째/세 번째 테스트에서 작품이 여전히 `active`/`hidden`이라 랭킹·상세에 남음.

- [ ] **Step 3: `withdrawMyAccount`에 작품 벌크 내림 추가**

`lib/artists.ts` 상단 drizzle import에 `inArray` 추가(현재 `import { and, asc, desc, eq, ilike, isNotNull, ne, or } from "drizzle-orm";`):

```ts
import { and, asc, desc, eq, ilike, inArray, isNotNull, ne, or } from "drizzle-orm";
```

`withdrawMyAccount`의 트랜잭션 안, `artists` update 다음에 작품 내림을 추가:

```ts
    await tx
      .update(artworks)
      .set({ status: "withdrawn" })
      .where(
        and(eq(artworks.artistId, artist.userId), inArray(artworks.status, ["active", "hidden"])),
      );
```

(주석 보강: 기존 "handle=null이라 자동 제외" 설명은 작가 페이지에만 해당하므로, 작품은 withdrawn으로 내려 랭킹·카드상세·검색카운트에서 빠진다는 점을 명시.)

- [ ] **Step 4: 통과 확인**

Run: `npm run test -- withdraw-hide`
Expected: PASS (3개 전부)

- [ ] **Step 5: 커밋**

```bash
git add lib/artists.ts tests/integration/withdraw-hide.test.ts
git commit -m "feat(withdraw): 탈퇴 시 작가 작품을 withdrawn으로 내려 공개 지면에서 제외"
```

---

### Task A2: 과거 탈퇴자 백필 마이그레이션

이미 탈퇴됐는데(= `artists.deleted_at` 있음) 작품이 아직 `active`/`hidden`인 경우를 일회성으로 내린다. 멱등.

**Files:**
- Create: `infra/db/migrations/20261108_130000_withdraw_hide_artworks.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 과거 탈퇴자(artists.deleted_at NOT NULL)의 남은 공개 작품을 내린다.
-- Task A1 이후 신규 탈퇴는 withdrawMyAccount가 처리하므로 이 백필은 기존 데이터용. 멱등.
update public.artworks w
   set status = 'withdrawn'
  from public.artists a
 where w.artist_id = a.user_id
   and a.deleted_at is not null
   and w.status in ('active', 'hidden');
```

- [ ] **Step 2: 적용**

Run: `npm run db:migrate`
Expected: 출력 `실행 ...: 20261108_130000_withdraw_hide_artworks.sql` 포함, 에러 없음.

- [ ] **Step 3: 검증(남은 대상 0건)**

Run:
```bash
node --env-file-if-exists=.env.local --import tsx -e "import {db} from './lib/db';import {sql} from 'drizzle-orm';const r=await db.execute(sql\`select count(*)::int as n from public.artworks w join public.artists a on a.user_id=w.artist_id where a.deleted_at is not null and w.status in ('active','hidden')\`);console.log(r.rows);process.exit(0)"
```
Expected: `[ { n: 0 } ]`

- [ ] **Step 4: 재실행 멱등 확인**

Run: `npm run db:migrate` 다시 → 이미 적용돼 `건너뜀`에 집계되거나 변화 없음. (migrate 러너가 적용분을 기록하므로 재실행 시 skip.)

- [ ] **Step 5: 커밋**

```bash
git add infra/db/migrations/20261108_130000_withdraw_hide_artworks.sql
git commit -m "chore(db): 과거 탈퇴 작가 작품 백필(withdrawn)"
```

---

# PART B — 카드검색 서버 페이지네이션

REQUIRED SKILL: @superpowers:test-driven-development

### Task B1: 검색 stored proc에 limit/offset 추가 (마이그레이션)

함수 시그니처가 바뀌므로 `DROP` 후 `CREATE`. 본문은 기존과 동일하고 끝의 `limit 50`만 `limit p_limit offset p_offset`로 교체.

**Files:**
- Create: `infra/db/migrations/20261108_140000_search_pagination.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 카드 검색 함수에 limit/offset 추가(무한스크롤 서버 페이지네이션).
-- 본문·정렬·card_hit 반환 타입은 기존과 동일. 끝의 limit 50 → limit/offset.
drop function if exists public.search_cards_by_number(text, text, text);
create function public.search_cards_by_number(
  p_set text, p_number text, p_total text,
  p_limit int default 20, p_offset int default 0
)
returns setof public.card_hit
language sql
stable
set search_path = ''
as $$
  with matched as (
    select c.id as card_id, null::text as alias_lang, null::text as alias_set_code,
           null::text as alias_number
    from public.cards c
    where (p_set is null or lower(c.set_code) = lower(p_set))
      and public.normalize_collector_number(split_part(c.collector_number, '/', 1)) = p_number
      and (p_total is null
           or public.normalize_collector_number(split_part(c.collector_number, '/', 2)) = p_total)
    union all
    select a.card_id, a.lang, a.set_code, a.collector_number
    from public.card_aliases a
    where (p_set is null or lower(a.set_code) = lower(p_set))
      and public.normalize_collector_number(split_part(a.collector_number, '/', 1)) = p_number
      and (p_total is null
           or public.normalize_collector_number(split_part(a.collector_number, '/', 2)) = p_total)
  ),
  best as (
    select distinct on (card_id) *
    from matched
    order by card_id, alias_lang nulls first
  )
  select c.id, c.set_code, c.collector_number, c.name_ko, c.rarity, s.name_ko, s.released_on,
         (select count(*)::int from public.artworks w
           where w.card_id = c.id and w.status = 'active'),
         b.alias_lang, b.alias_set_code, b.alias_number
  from best b
  join public.cards c on c.id = b.card_id
  join public.sets s on s.code = c.set_code
  order by 8 desc, s.released_on desc nulls last, c.collector_number
  limit p_limit offset p_offset
$$;

drop function if exists public.search_cards_by_name(text);
create function public.search_cards_by_name(
  p_text text, p_limit int default 20, p_offset int default 0
)
returns setof public.card_hit
language sql
stable
set search_path = ''
as $$
  with matched as (
    select c.id as card_id,
           public.similarity(c.name_ko, p_text) as score
    from public.cards c
    where c.name_ko operator(public.%) p_text or c.name_ko ilike '%' || p_text || '%'
    union all
    select a.card_id, public.similarity(a.name, p_text)
    from public.card_aliases a
    where a.name operator(public.%) p_text or a.name ilike '%' || p_text || '%'
  ),
  best as (
    select card_id, max(score) as score from matched group by card_id
  )
  select c.id, c.set_code, c.collector_number, c.name_ko, c.rarity, s.name_ko, s.released_on,
         (select count(*)::int from public.artworks w
           where w.card_id = c.id and w.status = 'active'),
         null::text, null::text, null::text
  from best b
  join public.cards c on c.id = b.card_id
  join public.sets s on s.code = c.set_code
  order by 8 desc, b.score desc, s.released_on desc nulls last, c.collector_number
  limit p_limit offset p_offset
$$;
```

- [ ] **Step 2: 적용 + 스모크**

Run: `npm run db:migrate`
Expected: `실행 ...: 20261108_140000_search_pagination.sql` 포함.

Run(스모크):
```bash
node --env-file-if-exists=.env.local --import tsx -e "import {db} from './lib/db';import {sql} from 'drizzle-orm';const r=await db.execute(sql\`select count(*)::int as n from public.search_cards_by_name('a', 5, 0)\`);console.log('ok',r.rows);process.exit(0)"
```
Expected: 에러 없이 `ok [ { n: ... } ]`.

- [ ] **Step 3: 커밋**

```bash
git add infra/db/migrations/20261108_140000_search_pagination.sql
git commit -m "feat(db): 카드 검색 함수에 limit/offset 추가"
```

---

### Task B2: `lib/cards.ts` — `searchCards(query, opts)` + `hasMore`

**Files:**
- Modify: `lib/cards.ts` (`SearchResult`, `searchCards`, `cardCandidates`)
- Test: `tests/integration/cards-search.test.ts` (케이스 추가)

- [ ] **Step 1: 실패 테스트 추가**

`tests/integration/cards-search.test.ts`의 `beforeAll`에 **이름이 같은 패턴을 공유하는 카드 3장**을 추가로 넣는다(기존 2장과 별개). 파일 상단 변수에 추가:

```ts
let pageCardIds: string[] = []; // 페이지네이션 검증용(같은 이름 토큰 공유)
```

`beforeAll` 끝에 추가:

```ts
  const pageRows = await db
    .insert(cards)
    .values([
      { setCode: SET_CODE, collectorNumber: "301/165", nameKo: `${TAG}페이지 하나` },
      { setCode: SET_CODE, collectorNumber: "302/165", nameKo: `${TAG}페이지 둘` },
      { setCode: SET_CODE, collectorNumber: "303/165", nameKo: `${TAG}페이지 셋` },
    ])
    .returning({ id: cards.id });
  pageCardIds = pageRows.map((r) => r.id);
```

`afterAll`의 cards 삭제를 pageCardIds까지 포함하도록 수정:

```ts
  await db.delete(cards).where(inArray(cards.id, [charizardId, mewId, ...pageCardIds]));
```

그리고 새 describe 블록 추가:

```ts
describe("searchCards 페이지네이션 (limit/offset/hasMore)", () => {
  it("limit보다 매칭이 많으면 hasMore=true, 결과는 limit개", async () => {
    const page1 = await searchCards(`${TAG}페이지`, { limit: 2, offset: 0 });
    expect(page1.hits.length).toBe(2);
    expect(page1.hasMore).toBe(true);
  });

  it("offset으로 다음 페이지를 이어 받고, 끝에선 hasMore=false", async () => {
    const page1 = await searchCards(`${TAG}페이지`, { limit: 2, offset: 0 });
    const page2 = await searchCards(`${TAG}페이지`, { limit: 2, offset: 2 });
    const ids1 = page1.hits.map((h) => h.cardId);
    const ids2 = page2.hits.map((h) => h.cardId);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false); // 안 겹침
    expect(page2.hasMore).toBe(false); // 총 3장이므로 offset 2면 1장, 더 없음
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- cards-search`
Expected: FAIL — `searchCards`가 opts를 무시하고 `hasMore`가 `undefined`.

- [ ] **Step 3: `searchCards` 구현 변경**

`lib/cards.ts`:

`SearchResult` 타입에 `hasMore` 추가:
```ts
export type SearchResult = { parsed: ParsedQuery; hits: CardHit[]; hasMore: boolean };
```

`searchCards` 교체:
```ts
export async function searchCards(
  query: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<SearchResult> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  const parsed = parseQuery(query);
  if (parsed.kind === "empty") return { parsed, hits: [], hasMore: false };

  // hasMore 판정용으로 limit+1개 요청(별도 count 쿼리 없음).
  const fetchLimit = limit + 1;
  const result =
    parsed.kind === "name"
      ? await db.execute(
          sql`select * from public.search_cards_by_name(${parsed.text}, ${fetchLimit}, ${offset})`,
        )
      : await db.execute(
          sql`select * from public.search_cards_by_number(${parsed.kind === "set_number" ? parsed.set : null}, ${parsed.number}, ${parsed.total}, ${fetchLimit}, ${offset})`,
        );
  const rows = result.rows as CardHitRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const hits = await withImagePaths(page.map(toHit));
  return { parsed, hits, hasMore };
}
```

`cardCandidates`는 후보 개수를 유지하려 limit을 넉넉히:
```ts
export async function cardCandidates(query: string) {
  const { hits } = await searchCards(query.slice(0, 100), { limit: 50 });
  ...
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm run test -- cards-search`
Expected: PASS (기존 케이스 + 신규 2개)

- [ ] **Step 5: 커밋**

```bash
git add lib/cards.ts tests/integration/cards-search.test.ts
git commit -m "feat(search): searchCards에 limit/offset/hasMore 지원"
```

---

### Task B3: `/api/search` 라우트 + card-search 도메인 파일

**Files:**
- Create: `app/api/search/route.ts`
- Create: `domains/card-search/api/endpoints.ts` · `api/queries.ts` · `api/types.ts`
- Test: `tests/integration/search-route.test.ts` (생성)

- [ ] **Step 1: 도메인 파일 생성**

`domains/card-search/api/endpoints.ts`:
```ts
export const CARD_SEARCH_ENDPOINTS = {
  page: (q: string, offset: number) =>
    `/api/search?q=${encodeURIComponent(q)}&offset=${offset}`, // GET → { hits, hasMore }
} as const;
```

`domains/card-search/api/queries.ts`:
```ts
export const cardSearchKeys = {
  all: ["card-search"] as const,
  byQuery: (q: string) => [...cardSearchKeys.all, q] as const,
};
```

`domains/card-search/api/types.ts`:
```ts
import type { CardHit } from "@/lib/cards";

export type CardSearchPage = { hits: CardHit[]; hasMore: boolean };
```

- [ ] **Step 2: 실패 테스트 작성**

`tests/integration/search-route.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { cards, sets } from "@/lib/db/schema";
import { GET } from "@/app/api/search/route";
import type { CardSearchPage } from "@/domains/card-search/api/types";

const TAG = `srt${Date.now()}`;
const SET_CODE = `${TAG}set`;
let ids: string[] = [];

beforeAll(async () => {
  await db.insert(sets).values({ code: SET_CODE, nameKo: `${TAG} 세트` });
  const rows = await db
    .insert(cards)
    .values([
      { setCode: SET_CODE, collectorNumber: "401/165", nameKo: `${TAG}라우트 하나` },
      { setCode: SET_CODE, collectorNumber: "402/165", nameKo: `${TAG}라우트 둘` },
      { setCode: SET_CODE, collectorNumber: "403/165", nameKo: `${TAG}라우트 셋` },
    ])
    .returning({ id: cards.id });
  ids = rows.map((r) => r.id);
});

afterAll(async () => {
  await db.delete(cards).where(inArray(cards.id, ids));
  await db.delete(sets).where(eq(sets.code, SET_CODE));
});

const call = async (q: string, offset: number): Promise<CardSearchPage> => {
  const res = await GET(new Request(`http://t/api/search?q=${encodeURIComponent(q)}&offset=${offset}`));
  return (await res.json()) as CardSearchPage;
};

describe("GET /api/search", () => {
  it("offset/limit 페이지를 JSON으로 돌려준다", async () => {
    const p1 = await call(`${TAG}라우트`, 0);
    expect(p1.hits.length).toBeGreaterThan(0);
    expect(typeof p1.hasMore).toBe("boolean");
  });

  it("q가 비면 빈 결과", async () => {
    const empty = await call("   ", 0);
    expect(empty.hits).toEqual([]);
    expect(empty.hasMore).toBe(false);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npm run test -- search-route`
Expected: FAIL — `@/app/api/search/route`가 없음.

- [ ] **Step 4: 라우트 구현**

`app/api/search/route.ts`:
```ts
import { searchCards } from "@/lib/cards";

// 카드 검색 페이지 조회(무한스크롤 2페이지+). 1페이지는 app/search가 SSR로 직접 lib을 부른다.
// 계측(recordSearch)은 1페이지에서만 하므로 여기선 하지 않는다(중복 집계 방지).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 100);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  if (!q.trim()) return Response.json({ hits: [], hasMore: false });
  const { hits, hasMore } = await searchCards(q, { offset, limit: 20 });
  return Response.json({ hits, hasMore });
}
```

- [ ] **Step 5: 통과 확인 + 커밋**

Run: `npm run test -- search-route`
Expected: PASS

```bash
git add app/api/search/route.ts domains/card-search/
git commit -m "feat(search): /api/search 라우트 + card-search 도메인 키/타입"
```

---

### Task B4: 프론트 — 무한스크롤 클라 컴포넌트 + 훅, search 페이지 위임

프론트 상호작용은 통합테스트 대상이 아니라 **빌드/타입체크 + 수동(dev) 검증**으로 확인한다.

**Files:**
- Create: `domains/card-search/hooks.ts`
- Create: `components/search-results.tsx`
- Modify: `app/search/page.tsx`

- [ ] **Step 1: 무한쿼리 훅**

`domains/card-search/hooks.ts`:
```ts
"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { CARD_SEARCH_ENDPOINTS } from "./api/endpoints";
import { cardSearchKeys } from "./api/queries";
import type { CardSearchPage } from "./api/types";

const PAGE_SIZE = 20;

// 1페이지(SSR)를 initialData로 주입받아, 2페이지부터 /api/search로 이어 받는다.
export const useCardSearchInfinite = (query: string, initial: CardSearchPage) =>
  useInfiniteQuery({
    queryKey: cardSearchKeys.byQuery(query),
    queryFn: ({ pageParam }) =>
      apiFetch<CardSearchPage>(CARD_SEARCH_ENDPOINTS.page(query, pageParam)),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length * PAGE_SIZE : undefined,
    initialData: { pages: [initial], pageParams: [0] },
  });
```

- [ ] **Step 2: 결과 격자 클라 컴포넌트**

`components/search-results.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";
import { CardTile } from "@/components/card-tile";
import type { CardSearchPage } from "@/domains/card-search/api/types";
import { useCardSearchInfinite } from "@/domains/card-search/hooks";

// 검색 결과 격자 + 무한스크롤. 1페이지는 서버가 준 initial로 즉시 그리고,
// 바닥 센티넬이 뷰포트에 가까워지면 다음 페이지를 당긴다.
export function SearchResults({ query, initial }: { query: string; initial: CardSearchPage }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useCardSearchInfinite(
    query,
    initial,
  );
  const sentinel = useRef<HTMLDivElement>(null);
  const hits = data?.pages.flatMap((p) => p.hits) ?? initial.hits;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <>
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
        카드 {hits.length}
        {hasNextPage ? "+" : ""}장
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {hits.map((hit) => (
          <li key={hit.cardId}>
            <CardTile
              card={{
                setCode: hit.setCode,
                collectorNumber: hit.collectorNumber,
                nameKo: hit.nameKo,
                imagePath: hit.imagePath,
                artworkCount: hit.artworkCount,
                rarity: hit.rarity,
                lang: hit.lang,
              }}
            />
          </li>
        ))}
      </ul>
      <div ref={sentinel} aria-hidden className="h-8" />
      {isFetchingNextPage && (
        <p className="mt-4 text-center text-sm text-muted-foreground">불러오는 중…</p>
      )}
    </>
  );
}
```

- [ ] **Step 3: `app/search/page.tsx`에서 위임**

`Results()` 안을 다음과 같이 바꾼다.

import 추가:
```ts
import { SearchResults } from "@/components/search-results";
```

`searchCards` 호출은 그대로(기본 limit 20):
```ts
const result = await searchCards(query);
```

단건 리다이렉트 조건을 `hasMore`까지 반영:
```ts
if (result.hits.length === 1 && !result.hasMore) {
  const hit = result.hits[0];
  ...
  redirect(cardPath(hit.setCode, hit.collectorNumber) + from);
}
```

결과 분기(현재 `CandidateGrid` 사용부)를 교체:
```tsx
  return (
    <SearchShell query={query}>
      <SearchResults
        query={query}
        initial={{ hits: result.hits, hasMore: result.hasMore }}
      />
    </SearchShell>
  );
```

기존 `CandidateGrid` 컴포넌트와 그 `CardHit` import는 더 이상 쓰지 않으면 제거(안 쓰는 import는 lint가 잡는다). `SearchLanding`/오타제안 분기는 그대로 둔다.

- [ ] **Step 4: 타입체크 + 린트 + 빌드**

Run: `npm run typecheck && npm run lint`
Expected: 통과(미사용 import/CandidateGrid 잔재 없음).

Run: `npm run build`
Expected: 성공.

- [ ] **Step 5: 수동 검증(dev)**

Run: `npm run dev` 후 결과가 20개를 넘는 흔한 검색어(예: `ex` 또는 데모 데이터상 다수 매칭되는 이름)로 `/search?q=...` 접속.
확인:
- 첫 20개가 SSR로 즉시 보인다.
- 아래로 스크롤하면 네트워크 탭에 `GET /api/search?q=...&offset=20` 발생, 다음 묶음이 append.
- 더 없을 때 추가 요청이 멈추고 "+" 표시가 사라진다.
- 결과 1건 검색어는 여전히 카드 상세로 즉시 리다이렉트, 0건은 오타 제안 노출.

(>20 결과를 만들 데모 데이터가 없으면 `npm run demo`로 시드 후 검증.)

- [ ] **Step 6: 커밋**

```bash
git add domains/card-search/hooks.ts components/search-results.tsx app/search/page.tsx
git commit -m "feat(search): 무한스크롤 결과 격자(useInfiniteQuery + IntersectionObserver)"
```

---

### Task B5: 회귀 — 검색 e2e 확인

**Files:**
- Check: `tests/e2e/search.spec.ts` (기존)

- [ ] **Step 1: 기존 검색 e2e 실행**

Run: `npm run test:e2e -- search`
Expected: 기존 시나리오(단건 리다이렉트/결과 격자/0건) 통과. 깨지면 셀렉터를 `SearchResults` 구조에 맞게 보정.

- [ ] **Step 2: (깨졌다면) 보정 후 커밋**

```bash
git add tests/e2e/search.spec.ts
git commit -m "test(e2e): 무한스크롤 검색 결과 구조에 맞게 셀렉터 보정"
```

---

## 마무리 체크

- [ ] 전체 테스트: `npm run test` (통합) + `npm run test:e2e` (e2e) 통과
- [ ] `npm run typecheck && npm run lint && npm run build` 통과
- [ ] 스펙의 "열린 질문" 두 개는 본 계획에서 해소: (1) 검색 훅/키는 `domains/card-search/`에 배치, (2) 백필은 기능1과 같은 PR 범위(Task A2).
- [ ] (의사결정 기록) 탈퇴 작품 내림은 `artwork_set_status`를 우회하는 단순 벌크 UPDATE로 간다. consent 로깅/파일 purge는 이번 범위 밖(후속). — 스펙 결정 반영.
