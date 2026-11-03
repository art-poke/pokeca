# 유저=작가 통합 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인한 누구나 곧 작가다. 신청·승인 플로우를 제거하고, members/artists를 단일 프로필(`artists`)로 합치며, "핸들 있으면 공개/발행"으로 게이트를 바꾼다.

**Architecture:** 소셜 로그인 → 첫 상호작용 때 프로필 자동생성(display_name 기본값, handle=null). 업로드/발행은 `requirePublisher`(handle 보유) 게이트. 공개 페이지는 `status='approved'` 대신 `handle IS NOT NULL` 기준. 작품 모더레이션(active/hidden/withdrawn, 신고)은 그대로 유지.

**Tech Stack:** Next 16 / React 19, Auth.js v5(JWT), Drizzle + node-postgres, Postgres(plpgsql), Vitest(integration) + Playwright(e2e).

**근거 설계:** `docs/superpowers/specs/2026-11-02-user-is-artist-design.md` (승인됨)

---

## 정책 요약 (무엇이 바뀌나)

| 축 | 이전 | 이후 |
|---|---|---|
| 신분 | member(일반) ↔ artist(승인된 작가) 2단계 | **프로필 하나.** 로그인 = 프로필 보유 |
| 승인 | 작가 신청 → 어드민 승인(pending/approved/rejected) | **승인 제거.** 신청·거절·대기 없음 |
| 발행 자격 | status='approved' | **handle 보유**(마이페이지에서 1회 설정) |
| 프로필 입력 | 신청 폼에서 handle+이름 필수 | 로그인 시 자동생성 → **발행 전 마이페이지에서 handle 설정** |
| 공개 노출 | status='approved' | **handle IS NOT NULL** |
| 화면 | `/me`(회원) + `/artist`(작가 스튜디오) 분리 | **마이페이지 하나로 통합** |
| 테이블 | `members` + `artists` | **`artists`(프로필) 하나**, members 흡수·삭제 |
| 유지 | — | 작품 상태(active/hidden/withdrawn)·신고·모더레이션·즐겨찾기·후기·추천/다운로드 |

**게이트 체계(신규)**
- `requireProfile()` — 로그인만. 댓글·커뮤니티·즐겨찾기·추천·다운로드·후기.
- `requirePublisher()` — handle 보유. 도안 업로드/발행. 없으면 마이페이지로 1회 유도.

**제거 대상(코드):** `app/artist/signup`, `app/admin/(console)/artists`, `reviewArtist`, `registerArtist`, `requireApplicant`, `setArtistStatus`, `anyApprovedArtist`, `ArtistStatus`, `lib/members.ts`, `lib/member-route.ts`(흡수).

---

## 파일 구조 (만들 것 / 고칠 것)

**DB**
- Modify: `infra/db/01_app.sql` — 끝에 새 마이그레이션 블록 추가(artists 재형성 + members drop)
- Modify: `lib/db/schema.ts:74-99` — artists 거울 재정의, members 제거

**프로필 코어 (members 흡수)**
- Modify: `lib/artists.ts` — Artist 타입/게이트/프로필 자동생성/발행 게이트 재작성
- Delete: `lib/members.ts` → 로직을 `lib/artists.ts`로 흡수. **단, 호출부 ~15곳 churn 최소화 위해 하위호환 alias 유지**: `export const currentMember = currentArtist`, `export const requireMember = requireProfile`, `export type Member = Artist`, `export const MemberError = ArtistError`, `export const updateProfile = ...`, `export const anyMember = ...`를 `lib/artists.ts`에서 내보낸다(옛 import 경로만 `@/lib/members`→`@/lib/artists`로 바꾸면 됨).
- Delete: `lib/member-route.ts` → `lib/artist-route.ts`의 `profileRoute`로 흡수. **`export const memberRoute = profileRoute` alias 유지**(아래 10개 API route 무수정 컴파일).
- Modify: `lib/artist-route.ts` — `profileRoute`(로그인) + `publisherRoute`(handle) 두 개로

**members 호출부 (import 경로만 교체, alias로 로직 무변경)** — 리뷰 C2:
- `currentMember`/`Member`: `app/cards/[set]/[number]/page.tsx:14,41`, `app/artists/[handle]/page.tsx:10,34`, `app/community/[id]/page.tsx:11,23`, `app/artworks/[id]/page.tsx:15,30`, `app/api/download/[id]/route.ts:6,14`, `domains/artwork/api/actions.ts:5,22`, `app/me/page.tsx`
- `requireMember`: `app/community/new/page.tsx:5,18`
- `memberRoute`: `app/api/comments/route.ts`, `app/api/comments/[id]/route.ts`, `app/api/member/favorites/route.ts`, `app/api/member/uploads/route.ts`, `app/api/reviews/route.ts`, `app/api/reviews/[id]/route.ts`, `app/api/artworks/[id]/recommend/route.ts`, `app/api/cards/[id]/request/route.ts`, `app/api/community/posts/route.ts`, `app/api/community/posts/[id]/route.ts`
- 처리: 전부 `from "@/lib/members"` → `from "@/lib/artists"`, `from "@/lib/member-route"` → `from "@/lib/artist-route"` 로 sed 치환(한 번에). alias 덕에 식별자/로직은 그대로.

**members *테이블* 직접 참조 (alias로 안 잡힘 — 리뷰 B1)**:
- `app/api/avatars/[userId]/route.ts:3,12-14` — `import { members } from "@/lib/db/schema"` + `.select({avatarPath: members.avatarPath}).from(members).where(eq(members.userId,…))`. avatar_path가 artists로 이동(Task 0.1 #3)하므로 **artists 테이블로 직접 교체**: `import { artists }` + `.select({avatarPath: artists.avatarPath}).from(artists).where(eq(artists.userId,…))`. Task 4.1 Step에서 처리(또는 전용 스텝). alias 무관한 raw 테이블 참조라 별도 수정 필수.

**승인 제거**
- Delete: `app/artist/signup/`, `app/admin/(console)/artists/`
- Modify: `app/admin/actions.ts:6,42-48` — reviewArtist 제거
- Modify: `app/artist/actions.ts` — registerArtist/apply 제거, socialLogin 세션 가드 추가

**게이트 교체 호출부**
- `lib/ranking.ts:83`, `lib/artworks.ts:313`, `lib/reviews.ts:75`, `lib/artist-route.ts:11` — approved → handle 기준

**통합 마이페이지 + 네비**
- Modify: `app/artist/(studio)/page.tsx`, `app/me/page.tsx` → 통합
- Modify: `components/auth-menu.tsx`, `components/user-menu.tsx` — approved/registered prop 제거
- Modify: `app/artist/login/page.tsx` + `socialLogin` — 로그인 상태면 리다이렉트(머지 방지)

**프로필 API**
- Modify: `app/api/member/profile/route.ts`, `domains/member/*` — 유지하되 프로필 코어로 연결, handle 설정 추가

**테스트/시드**
- Modify: `tests/integration/*`, `tests/e2e/artist.spec.ts`, `tests/e2e/admin.spec.ts`
- Modify: `scripts/seed-artists.mts`, `scripts/seed-demo.mts`

---

## 구현 순서 주의 (typecheck 게이트) — 리뷰 S4

이건 비점진적(cutover) 리팩토링이다. **Task 0.2(거울에서 status/members 제거)부터 Task 1.4(alias + import 치환 완료)까지는 전체 `npx tsc --noEmit`가 깨진 상태가 정상**이다. 그 구간의 검증은 각 태스크에 적힌 **grep-scoped 체크**만 신뢰한다(예: `grep -i "lib/members"`). 전체 typecheck 녹색은 **Task 1.4 이후부터** 기대한다. Phase 2~5의 전체 typecheck 게이트는 이 전제 위에서만 유효하다.

## Phase 0 — DB 마이그레이션 + 스키마 거울

### Task 0.1: artists 재형성 마이그레이션 블록 추가

**Files:**
- Modify: `infra/db/01_app.sql` (파일 끝에 append)

- [ ] **Step 1: 마이그레이션 블록 작성**

`infra/db/01_app.sql` 끝에 추가:
```sql
-- ========== 20261103000000_user_is_artist.sql ==========
-- 유저=작가 통합: 승인 제거, members 흡수, handle 발행 전 null 허용.
-- 런칭 전·데이터 폐기 가능 → members는 그냥 drop(데이터 이전 안 함).

-- 1) 승인 흔적 제거
drop index if exists artists_status;
alter table public.artists drop column if exists status;
alter table public.artists drop column if exists reviewed_at;
alter table public.artists drop column if exists reviewed_by;

-- 2) handle: 발행 전엔 없음(null 허용). unique·형식 체크는 유지(null은 통과).
alter table public.artists alter column handle drop not null;
alter table public.artists drop constraint if exists artists_handle_check;
alter table public.artists add constraint artists_handle_check
  check (handle is null or handle ~ '^[a-z0-9_]{2,30}$');

-- 3) 프로필 흡수: 아바타 컬럼(= 옛 members.avatar_path)
alter table public.artists add column if not exists avatar_path text;

-- 4) members 폐기(FK는 users만 참조했고 engagements/comments/favorites는 users 직참조)
drop table if exists public.members cascade;

-- 5) 공개/발행 조회용 인덱스(handle 보유 프로필)
create index if not exists artists_published on public.artists (handle) where handle is not null;
```

- [ ] **Step 2: 로컬 DB에 적용 재시드**

Run: `npm run db:reset` (없으면 `psql "$DATABASE_URL" -f infra/db/00_authjs.sql -f infra/db/01_app.sql` 로 fresh DB 재구성)
Expected: 에러 없이 완료. `\d public.artists` 에 status/reviewed_* 없음, handle nullable, avatar_path 존재, members 테이블 없음.

- [ ] **Step 3: 검증 쿼리**

Run: `psql "$DATABASE_URL" -c "\d public.artists"` + `psql "$DATABASE_URL" -c "\dt public.members"`
Expected: artists에 avatar_path 있고 status 없음; members "Did not find any relation".

- [ ] **Step 4: Commit**
```bash
git add infra/db/01_app.sql && git commit -m "db: 유저=작가 마이그레이션(승인 제거·members 흡수·handle nullable)"
```

### Task 0.2: Drizzle 스키마 거울 동기화

**Files:**
- Modify: `lib/db/schema.ts:74-99`

- [ ] **Step 1: artists 거울 재정의, members 제거**

`lib/db/schema.ts`의 artists를 아래로 교체, members 블록(91-99) 삭제:
```ts
// 프로필(=작가). 로그인하면 자동 생성. handle 있으면 공개/발행 가능.
export const artists = pgTable("artists", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  avatarPath: text("avatar_path"),
  handle: text("handle").unique(),              // 발행 전 null
  email: text("email"),
  provider: text("provider").notNull(),
  intro: text("intro"),
  linkUrl: text("link_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: members import 한 곳 전부 컴파일 에러로 드러내기**

Run: `npx tsc --noEmit 2>&1 | grep -i member | head`
Expected: `lib/members.ts`, `lib/member-route.ts`, `app/me/page.tsx` 등에서 members 참조 에러(Phase 1~4에서 해소).

- [ ] **Step 3: Commit**
```bash
git add lib/db/schema.ts && git commit -m "db(schema): artists 프로필 거울 재정의, members 제거"
```

---

## Phase 1 — 프로필 코어(lib/artists.ts) 재작성 + members 흡수

### Task 1.1: Artist(프로필) 타입·변환 재정의

**Files:**
- Modify: `lib/artists.ts:16-74`
- Test: `tests/integration/artists-auth.test.ts`

- [ ] **Step 1: 실패 테스트 — status 없는 프로필 타입**

`tests/integration/artists-auth.test.ts`에 추가:
```ts
it("프로필엔 status가 없고 handle은 null 가능", async () => {
  const p = await ensureProfile({ id: userId, email: null, provider: "kakao", name: "두리" });
  expect(p.handle).toBeNull();
  expect(p.displayName).toBe("두리");
  expect("status" in p).toBe(false);
});
```

- [ ] **Step 2: 실행 → 실패 확인**
Run: `npm test -- artists-auth` → `ensureProfile is not defined` / 타입 에러.

- [ ] **Step 3: 타입·컬럼·fromDrizzle 교체**

`lib/artists.ts`:
- `ArtistStatus`/`ARTIST_STATUSES` 삭제(16-17).
- `Artist` 타입: `status` 제거, `handle: string | null`, `displayName`, `avatarPath: string | null`, `email`, `provider`, `intro`, `linkUrl`, `createdAt`, `userId`.
- `artistColumns`/`DrizzleArtistRow`/`fromDrizzle`에서 status/reviewedAt/By 제거, avatarPath 추가.

- [ ] **Step 4: 통과 확인** Run: `npm test -- artists-auth` → PASS.
- [ ] **Step 5: Commit** `git commit -am "artists: 프로필 타입에서 승인(status) 제거, avatar/handle-null 반영"`

### Task 1.2: 프로필 자동생성 + 게이트(requireProfile/requirePublisher)

**Files:**
- Modify: `lib/artists.ts` (currentArtist 영역 96-133)
- Test: `tests/integration/artists-auth.test.ts`

- [ ] **Step 1: 실패 테스트**
```ts
it("currentProfile는 없으면 자동 생성(display_name 기본값, handle null)", async () => {
  const p = await currentProfileFor(session); // 테스트 헬퍼로 세션 주입
  expect(p?.handle).toBeNull();
});
it("requirePublisher는 handle 없으면 /me로 redirect", async () => { /* redirect throw 확인 */ });
```

- [ ] **Step 2: 실행 → 실패**
- [ ] **Step 3: 구현**

`lib/artists.ts`:
```ts
// 로그인한 유저의 프로필을 보장(없으면 소셜 이름으로 생성).
export async function ensureProfile(user: SocialUser): Promise<Artist> {
  const existing = await artistByUserId(user.id);
  if (existing) return existing;
  const displayName = (user.name?.trim() || `수집가-${user.id.slice(0, 4)}`).slice(0, 40);
  try {
    const rows = await db.insert(artists)
      .values({ userId: user.id, displayName, email: user.email, provider: user.provider })
      .returning(artistColumns);
    return fromDrizzle(rows[0]);
  } catch (e) {
    if (isUniqueViolation(e)) return (await artistByUserId(user.id))!; // 동시 첫 요청
    throw e;
  }
}

export async function currentArtist(): Promise<Artist | null> {
  const user = await currentSocialUser();
  return user ? ensureProfile(user) : null;   // 로그인=프로필 보장
}

// 로그인만 필요한 화면/액션.
export async function requireProfile(): Promise<Artist> {
  const user = await currentSocialUser();
  if (!user) redirect("/artist/login");
  return ensureProfile(user);
}

// 발행 자격: handle 보유. 없으면 마이페이지로 1회 유도.
export async function requirePublisher(): Promise<Artist> {
  const p = await requireProfile();
  if (!p.handle) redirect("/me?setup=handle");
  return p;
}
```
- `requireArtist`(119-125)·`requireApplicant`(128-133)·`anyApprovedArtist`(107-115) 삭제.

- [ ] **Step 4: 통과 확인** Run: `npm test -- artists-auth` → PASS.
- [ ] **Step 5: Commit** `git commit -am "artists: 프로필 자동생성 + requireProfile/requirePublisher 게이트"`

### Task 1.3: handle 설정 + 프로필 수정(members.updateProfile 흡수)

**Files:**
- Modify: `lib/artists.ts` (신규 updateProfile/setHandle)
- Delete: `lib/members.ts`
- Test: `tests/integration/artists-auth.test.ts`

- [ ] **Step 1: 실패 테스트** — `updateProfile`로 displayName/avatar 수정, `setHandle`로 handle 1회 설정(중복 시 handle_taken, 형식 오류 invalid_handle).
- [ ] **Step 2: 실행 → 실패**
- [ ] **Step 3: 구현** — members.ts의 `updateProfile`(닉네임→displayName, avatar promote/remove 로직)와 `HANDLE` 검증을 artists.ts로 이전. `setHandle(userId, handle)`: `HANDLE.test`, lower/trim, unique 위반 → `handle_taken`. `MemberError` → `ArtistError`로 통일. **하위호환 alias 내보내기**(위 파일구조의 alias 목록: `currentMember`/`requireMember`/`Member`/`MemberError`/`updateProfile`/`anyMember`). `lib/members.ts` 삭제. 옛 `@/lib/members` import 전부 `@/lib/artists`로 치환:
  Run: `grep -rl '"@/lib/members"' app lib components domains | xargs sed -i '' 's#@/lib/members#@/lib/artists#g'`
- [ ] **Step 4: 통과 확인** Run: `npm test -- artists-auth` ; `npx tsc --noEmit 2>&1 | grep -i "lib/members"` → 0건
- [ ] **Step 5: Commit** `git commit -am "artists: updateProfile/setHandle 흡수 + 하위호환 alias, lib/members.ts 삭제"`

### Task 1.4: 공통 게이트 라우트 통합(member-route 흡수)

**Files:**
- Modify: `lib/artist-route.ts`
- Delete: `lib/member-route.ts`
- Test: `tests/integration/` (라우트 사용하는 테스트가 있으면)

- [ ] **Step 1: 구현** — `lib/artist-route.ts`에 두 래퍼:
  - `profileRoute(handler)` = 옛 memberRoute(로그인만). 에러 매핑은 Review/Favorite/Artwork/Storage + `ArtistError` 포함(`MemberError`는 `ArtistError` alias라 그대로 매핑됨).
  - `publisherRoute(handler)` = 옛 artistRoute지만 `artist.status!=='approved'` 대신 `!artist.handle → 403 {code:"handle_required"}`.
  - **`export const memberRoute = profileRoute` alias 유지**. `lib/member-route.ts` 삭제 후 import 치환:
    Run: `grep -rl '"@/lib/member-route"' app lib | xargs sed -i '' 's#@/lib/member-route#@/lib/artist-route#g'`
- [ ] **Step 2: 타입체크** Run: `npx tsc --noEmit 2>&1 | grep -iE "member-route|artist-route"` → 없음.
- [ ] **Step 3: Commit** `git commit -am "route: profileRoute/publisherRoute 통합 + memberRoute alias, member-route 삭제"`

---

## Phase 2 — 승인 플로우 제거

### Task 2.1: 어드민 작가 승인 제거

**Files:**
- Delete: `app/admin/(console)/artists/`
- Modify: `app/admin/actions.ts:6,42-48`
- Modify: `lib/artists.ts` — `listArtists`/`setArtistStatus`/`approvedArtistId` 정리
- Test: `tests/integration/admin-actions.test.ts`, `admin-data-drizzle.test.ts`

- [ ] **Step 1: 테스트 수정** — reviewArtist/setArtistStatus 테스트 삭제. admin-data의 listArtists 기대값에서 status 제거(또는 listArtists 자체 제거).
- [ ] **Step 2: 구현** — `reviewArtist`(admin/actions.ts) + import 삭제. `setArtistStatus`·`listArtists`(승인 콘솔 전용) 삭제. 어드민 콘솔 네비에서 '작가 관리' 링크 제거(`app/admin/(console)/layout.tsx`).
- [ ] **Step 3: 통과/타입체크** Run: `npm test -- admin` ; `npx tsc --noEmit`
- [ ] **Step 4: Commit** `git commit -am "admin: 작가 승인 콘솔·reviewArtist·setArtistStatus 제거"`

### Task 2.2: 작가 신청 폼·액션 제거

**Files:**
- Delete: `app/artist/signup/`, `app/artist/AuthForms.tsx`(신청 부분)
- Modify: `app/artist/actions.ts:10,37-57` — `apply`/`registerArtist` import·호출 제거
- Modify: `lib/artists.ts` — `registerArtist`/`ArtistApplication` 제거(HANDLE은 setHandle에서 재사용)

- [ ] **Step 1: 구현** — signup 라우트·apply 액션·registerArtist 삭제. `app/artist/actions.ts`엔 `socialLogin`/`logout`/`withdrawMyArtwork`만 남긴다. withdraw는 `requireProfile`로 시작하되 소유권은 artworks.artist_id로 이미 검증(유지).
- [ ] **Step 2: 타입체크** Run: `npx tsc --noEmit 2>&1 | grep -iE "signup|registerArtist|requireApplicant|apply"` → 없음.
- [ ] **Step 3: Commit** `git commit -am "artist: 신청 폼·registerArtist·apply 제거"`

---

## Phase 3 — 공개/발행 게이트 교체 (approved → handle)

### Task 3.1: 공개 노출을 handle 기준으로

**Files:**
- Modify: `lib/artists.ts` — `getPortfolio`(257-306), `approvedArtistId`→`publishedArtistId`(226-234), `searchArtists`(239-250)
- Modify: `lib/ranking.ts:83`, `lib/artworks.ts:313`, `lib/reviews.ts:75`
- Modify: `lib/artist-route.ts` (Task 1.4에서 처리됨 — 확인만)
- Test: `tests/integration/artist-data-drizzle.test.ts`, `reviews.test.ts`, 랭킹/artworks 관련

- [ ] **Step 1: 실패 테스트** — handle 있는 프로필만 포트폴리오/검색/랭킹/후기 대상에 포함, handle=null은 비공개.
- [ ] **Step 2: 실행 → 실패**
- [ ] **Step 3: 구현** — `lib/artists.ts`에 `import { isNotNull } from "drizzle-orm"` 추가(현재 import 줄 4에 없음). 위치별로 **where절 교체 vs select/JS 읽기 교체를 구분**(리뷰 I2/I3):
  - `lib/artists.ts` **where절 교체**: `getPortfolio`(262) `and(eq(handle), eq(status,"approved"))` → `and(eq(handle), isNotNull(handle))`(사실상 eq(handle)로 충분). `approvedArtistId`(231) → `publishedArtistId`로 rename, where `and(eq(handle), isNotNull(handle))`. `searchArtists`(246) `eq(status,"approved")` 제거하고 `isNotNull(artists.handle)` 추가.
  - `lib/ranking.ts` **select/JS 읽기**: 66줄 `status: artists.status` select 제거, 83줄 `a?.status === "approved" ? handle : null` → `a?.handle ?? null`.
  - `lib/artworks.ts:313` **select/JS 읽기**: 상단 join select의 `artists.status`를 `artists.handle`로 교체, 313줄 `r.artists?.status === "approved"` → `r.artists?.handle ?? null`(= 공개 작가 링크는 handle 있을 때만).
  - `lib/reviews.ts:69-75` **select + JS 가드**: `.select({ status: artists.status })` → `.select({ handle: artists.handle })`, `if (status!=="approved") throw` → `if (!artist || !artist.handle) throw`.
  - `app/api/reviews/route.ts`: `approvedArtistId` import/호출 → `publishedArtistId`.
- [ ] **Step 4: 통과 확인** Run: `npm test -- artist-data reviews` ; `npx tsc --noEmit 2>&1 | grep -iE "ranking|artworks|reviews|artists"` → status 잔재 0건
- [ ] **Step 5: Commit** `git commit -am "public: 공개/발행 게이트를 handle 보유 기준으로 전환(select·where 정확히)"`

### Task 3.2: 발행(업로드) 라우트·페이지 게이트 교체

**Files:**
- Modify: `app/api/artist/artworks/route.ts`, `app/api/artist/uploads/route.ts`, `app/api/artist/cards/route.ts` — `artistRoute`→`publisherRoute`
- Modify: `app/artist/(studio)/new/page.tsx:25` — `currentArtist` + handle 없으면 `/me?setup=handle`

- [ ] **Step 1: 구현** — 업로드 계열은 publisherRoute로. 업로드 페이지 진입 시 handle 없으면 마이페이지로 유도.
- [ ] **Step 2: 타입체크/통과** Run: `npx tsc --noEmit`; `npm test`
- [ ] **Step 3: Commit** `git commit -am "artist: 업로드/발행 경로를 publisher 게이트로"`

---

## Phase 4 — 통합 마이페이지 + 네비 + 로그인 가드

### Task 4.1: 마이페이지 통합(/me = 프로필 + 내 도안/통계)

**Files:**
- Modify: `app/me/page.tsx` — 프로필 편집 + handle 설정 + 내 도안/통계(StudioArtworks·artistStats 흡수)
- Modify: `app/artist/(studio)/page.tsx` — `/me`로 redirect(또는 스튜디오 제거하고 /me로 통합)
- Modify: `components/profile-edit.tsx` — handle 설정 필드 추가(없을 때 "발행하려면 주소 이름 설정" 유도), `setup=handle` 쿼리 시 자동 편집모드
- Modify: `app/api/member/profile/route.ts` + `domains/member/*` — handle 포함 PATCH

- [ ] **Step 1: 구현** — `/me`: 상단 프로필(아바타+displayName+handle 설정) + 하단 내 도안 그리드/통계/후기(옛 studio 내용). `anyMember`/`anyApprovedArtist` 미리보기는 `currentArtist`(자동생성)로 단순화. `app/artist`는 `/me`로 redirect.
- [ ] **Step 2a: 아바타 라우트 테이블 교체 (리뷰 B1)** — `app/api/avatars/[userId]/route.ts`: `members` → `artists` 테이블 직접 교체(`import { artists }`, `.select({avatarPath: artists.avatarPath}).from(artists).where(eq(artists.userId, userId))`). alias로 안 잡히는 raw 참조.
- [ ] **Step 2: 클라 타입 `nickname`→`displayName` (리뷰 C3/I1)** — `domains/member/api/types.ts`의 `UpdateProfileInput { nickname }` → `{ displayName; handle?; avatarUploadId }`. `domains/member/hooks.ts`·`components/profile-edit.tsx`의 `nickname` 참조 갱신. `app/api/member/profile/route.ts`가 새 필드로 `updateProfile`+`setHandle` 호출. (선택: `lib/profile.ts`의 `NICKNAME_MAX` → `DISPLAY_NAME_MAX` 리네임 — 값 40 동일, 리뷰 B3 cosmetic)
- [ ] **Step 3: author_name 스냅샷 소스 확인 (리뷰 C3)** — 댓글/글/후기 작성 시 작성자명 스냅샷이 옛 `member.displayName`(=artistName ?? nickname)에서 `profile.displayName`로 바뀌어도 동일 의미인지 확인: `app/api/comments/route.ts:20`, `app/api/community/posts/route.ts:13`, `app/api/reviews/route.ts:14`. alias로 `currentMember=currentArtist`라 `.displayName` 그대로 동작(프로필 단일화로 artistName==displayName).
- [ ] **Step 4: 수동 확인(dev)** — 로그인 → /me에서 handle 설정 → 업로드 가능해짐. 댓글 작성 시 작성자명=displayName.
- [ ] **Step 5: 타입체크/통과** Run: `npx tsc --noEmit`; `npm test`
- [ ] **Step 6: Commit** `git commit -am "me: 마이페이지에 프로필+handle+내 도안 통합, 클라 타입 displayName화, /artist→/me"`

### Task 4.2: 네비/메뉴에서 승인·작가 구분 제거

**Files:**
- Modify: `components/auth-menu.tsx:9-24`, `components/user-menu.tsx`

- [ ] **Step 1: 구현** — `components/user-menu.tsx`: `approved`/`registered` prop 및 `statusLabel` 제거. **죽은 링크 수정(리뷰 I4)**: 53줄 `registered ? "/artist" : "/artist/signup"`(signup은 Task 2.2에서 삭제됨) → 단일 `/me`. 58줄 `approved && handle` 블록(공개 작가 페이지 링크) → `handle ? <Link href={/artists/${handle}}> : null`(handle nullable 가드). `components/auth-menu.tsx`: `currentSocialUser` 폴백 분기(21-24, currentArtist가 항상 프로필 반환하므로 dead) 삭제, `UserMenu`엔 `name={artist.displayName} handle={artist.handle}`만.
- [ ] **Step 2: 타입체크** Run: `npx tsc --noEmit 2>&1 | grep -iE "user-menu|auth-menu"` → 없음
- [ ] **Step 3: Commit** `git commit -am "nav: 승인/작가 구분 UI 제거, user-menu 죽은 /artist/signup 링크·handle 가드 수정"`

### Task 4.3: 로그인 페이지 세션 가드(provider 머지 방지)

**Files:**
- Modify: `app/artist/login/page.tsx`, `app/artist/actions.ts` (socialLogin)

- [ ] **Step 1: 구현** — 로그인 페이지: `await currentSocialUser()` 있으면 `redirect("/me")`. `socialLogin` 액션: 세션 있으면 provider 링크 대신 `/me`로 redirect(이미 로그인 유저가 다른 provider 눌러도 기존 계정에 안 붙게).
- [ ] **Step 2: 수동 확인** — 로그인 상태에서 /artist/login 직접 접근 → /me로 튕김. (앞서 발견한 kakao+google 머지 재현 안 됨)
- [ ] **Step 3: Commit** `git commit -am "auth: 로그인 상태면 로그인 페이지/소셜로그인 차단(provider 머지 방지)"`

---

## Phase 5 — 테스트·시드 정합 + 전체 녹색

### Task 5.1: 시드 스크립트 정합

**Files:**
- Modify: `scripts/seed-artists.mts`, `scripts/seed-demo.mts`

- [ ] **Step 1: 구현** — "approved 작가 5 + 비작가 회원 5" → "프로필 N명(일부 handle 보유=발행자, 일부 handle=null)". members insert 제거. status insert 제거.
- [ ] **Step 2: 재시드 확인** Run: `npm run demo` (또는 seed 스크립트) → 에러 없음, 공개 작가 페이지에 handle 보유자만 노출.
- [ ] **Step 3: Commit** `git commit -am "seed: 단일 프로필 모델로 시드 재작성"`

### Task 5.2: E2E 갱신

**Files:**
- Modify: `tests/e2e/artist.spec.ts` (신청→승인→업로드 → 로그인→handle설정→업로드)
- Delete/Modify: `tests/e2e/admin.spec.ts` 중 작가 관리 콘솔 시나리오

- [ ] **Step 1: 구현** — 승인 단계 제거. "로그인 → 마이페이지 handle 설정 → 도안 업로드 → 공개 확인" 플로우로.
- [ ] **Step 2: 실행** Run: `npm run test:e2e -- artist` → PASS.
- [ ] **Step 3: Commit** `git commit -am "e2e: 승인 제거, handle 설정 발행 플로우로 갱신"`

### Task 5.3: 최종 게이트 — typecheck + test + build

- [ ] **Step 1** Run: `npx tsc --noEmit` → 에러 0.
- [ ] **Step 2** Run: `npm test` → 전부 PASS (status/member 잔재 테스트 없음).
- [ ] **Step 3** Run: `npm run build` → 성공.
- [ ] **Step 4: grep 잔재 확인** Run: `grep -rnE "status.*approved|registerArtist|requireApplicant|setArtistStatus|anyApprovedArtist|lib/members|member-route|ArtistStatus|from\(members\)|members\.avatarPath|members\b.*schema" app lib components domains` → 0건. (B2: `members` 테이블 직접참조 누락까지 잡게 패턴 확장)
- [ ] **Step 5: Commit** `git commit -am "chore: 유저=작가 통합 마무리 — typecheck/test/build 녹색"`

---

## DoD
- [ ] 단일 `artists` 프로필, members 삭제. 로그인=프로필 자동생성.
- [ ] 승인/신청/거절 완전 제거(코드·UI·DB).
- [ ] 발행=handle 보유(`requirePublisher`), 공개=handle 보유.
- [ ] `/me` 통합 마이페이지(프로필+handle+내 도안). `/artist`→`/me`.
- [ ] 로그인 상태 가드로 provider 머지 불가.
- [ ] 작품 모더레이션(상태·신고) 유지.
- [ ] typecheck/test/build/e2e 녹색, 잔재 grep 0건.

## 메모 / 범위 밖
- 어드민 유저 차단(악용 대비)은 YAGNI 제외.
- Kakao 이메일 스코프(비즈 검증) 별건 — 이번 범위 아님.
- `email`/`name`을 users 테이블에 채우는 OAuth 프로필 매핑 개선은 후속(프로필 display_name은 자동 기본값으로 충분).
