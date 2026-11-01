# AWS 이전 Phase 2 — 서브 C 설계: 인증 이전(Auth.js) + 데이터 계층 RDS 이전(Drizzle)

- 작성일: 2026-11-01
- 상위 설계: `2026-11-01-aws-phase2-design.md` (Phase 2 전체), `2026-10-31-aws-infra-phase1-design.md` (Phase 1)
- 전제: Phase 1(인프라) + Phase 2 서브 B(RDS 스키마 25테이블 적용) 완료.
- 작업 레포: `~/orca/projects/art-poke/pokeca`, 브랜치 `feat/frontend-wire-migrate`.
- AWS: **반드시 `--profile artpoke` (계정 138681986450)**. 회사 `gr-readonly` 금지.

---

## 0. 한 줄 요약

Supabase Auth → **Auth.js v5**로 교체하고, 동시에 Supabase 데이터 접근 계층(`db()`, PostgREST 134곳) → **Drizzle ORM(RDS 직결)**로 전환한다. 서브 C 끝에 **로컬에서 카카오·구글·어드민 로그인 + 전체 앱 데이터가 RDS(Drizzle)로 동작**한다. 실제 AWS 배포는 서브 A.

---

## 1. 왜 "인증"만이 아니라 "데이터 계층"까지 묶이는가 (핵심 근거)

브레인스토밍에서 확인된 사실:

- 인증 호출부는 작다(~9곳). 그러나 **데이터 접근 `db()`는 134 call-site(소스 ~115 + 테스트/헬퍼 ~19) / 소스 22 파일**이고 Supabase PostgREST 문법(`db().from("x").select().eq(...)`)에 묶여 있다.
- 모든 auth 헬퍼(`currentArtist`, `currentMember`, `currentAdmin`)는 **세션에서 user id를 얻자마자 곧바로 앱 테이블을 `user_id`로 조회**한다. 예: `lib/artists.ts:83` `db().from("artists").select(COLUMNS).eq("user_id", userId)`.
- 그 앱 테이블들은 **RDS에 있고 FK `user_id → users.id`** 를 갖는다(`infra/db/01_app.sql`의 admins/artists/members/engagements/comments/posts/requests).
- 따라서 Auth.js가 RDS의 `users.id`를 돌려주는데 `db()`가 여전히 Supabase를 조회하면 **두 DB 간 split-brain**(id 불일치)으로 모든 조회가 깨진다.
- "users는 RDS"는 Phase 2에서 **확정(재논의 금지)** 결정이다.

**결론:** 인증을 RDS에서 end-to-end로 동작시키려면 데이터 접근 계층도 RDS로 함께 옮겨야 한다. 서브 C의 범위 = **인증 + 데이터 접근 계층 RDS 전환.** 데이터 이전(pg_dump/seed)도 여기에 흡수된다.

---

## 2. 확정 결정 (브레인스토밍 결과)

| # | 항목 | 결정 | 근거 |
|---|---|---|---|
| C-1 | 인증 라이브러리 | **Auth.js v5** (`next-auth@5.0.0-beta.32`) | Next 16·React 19 호환 확인(peer: `next ^14‖^15‖^16`, `react ^18.2‖^19`). repo=next 16.4.3 / react 19.3.0 |
| C-2 | 공급자 | **Kakao, Google**(OAuth) + **Credentials**(어드민, bcrypt) | 현 소셜 로그인 + 어드민 비번 로그인 대체 |
| C-3 | 세션 전략 | **JWT** (DB 세션 아님) | Auth.js Credentials는 JWT 세션에서만 동작. 어드민이 Credentials라 **강제**. `00_authjs.sql`의 `sessions` 테이블은 미사용 |
| C-4 | DB 도구(ORM) | **Drizzle ORM** (`drizzle-orm@0.45.x`) | 서버리스(Lambda) 경량·커넥션 수월, 타입 강함, 기존 체인 문법과 매핑 자연스러움 |
| C-5 | Auth.js 어댑터 | **`@auth/drizzle-adapter@1.11.x`** | C-4와 일치 |
| C-6 | 로컬 개발 DB | **Docker Postgres(표준 5432) + `infra/db/*.sql` 스키마 + 시드** | RDS는 비공개 VPC라 로컬 직결 불가. 포트 5432 확보됨(충돌 없음) |
| C-7 | 데이터 이전 | **새로 시작(기존 유저 이전 없음)** | 런칭 전·실데이터 없음. 어드민 bcrypt 재생성, 나머지 `npm run demo` 재시드 |
| C-8 | 권한(인가) | **앱 레이어 if문 유지** (Phase 2 확정 재확인) | 현 구조 그대로. "누구냐"만 교체 |

---

## 3. 현재 상태 맵 (교체 대상)

### 3.1 Supabase 클라이언트 2종
- `lib/supabase/auth.ts` — `authClient()`: `createServerClient`(SSR, 쿠키). 인증용.
- `lib/supabase/server.ts` — `db()`: `createClient`(service_role, `SUPABASE_SECRET_KEY`). 데이터 접근용 싱글턴.

### 3.2 인증 호출부 (전수, 교체 대상)
| 파일 | 라인 | 메서드 |
|---|---|---|
| `lib/admin.ts` | 13 | `getUser()` |
| `lib/artists.ts` | 72 | `getUser()` |
| `app/artist/actions.ts` | 36 | `signInWithOAuth()` |
| `app/artist/actions.ts` | 65 | `signOut()` |
| `app/admin/actions.ts` | 15 | `signInWithPassword()` |
| `app/admin/actions.ts` | 24 | `signOut()` |
| `app/artist/callback/route.ts` | 14 | `exchangeCodeForSession()` |
| `proxy.ts` | 56 | `getUser()` (세션 리프레시) |
| `tests/e2e/db.ts` | 115 | `signInWithPassword()` (테스트) |

### 3.3 auth 헬퍼 (세션→유저 판별, 재작성 대상)
- `lib/admin.ts` — `currentAdmin()`, `requireAdmin()` (+`admins` 조회)
- `lib/artists.ts` — `currentSocialUser()`, `currentArtist()`, `requireArtist()`, `registerArtist()`, `setArtistStatus()`, `getArtistById()`
- `lib/members.ts` — `currentMember()`, `requireMember()`, `updateProfile()`, `anyMember()`
- `components/auth-menu.tsx` — `currentArtist()/currentSocialUser()/currentAdmin()` 호출

소셜 프로필 추출 현행(`lib/artists.ts:74-79`): `user.app_metadata.provider`, `user_metadata.{full_name,name,nickname,preferred_username}` → Auth.js `profile()` 콜백으로 매핑 필요.

### 3.4 데이터 접근 `db()` (총 134곳 = 소스 ~115 + 테스트/헬퍼 ~19)
**⚠️ `db()` 호출은 3종류다 — 전부 PostgREST가 아님(플랜 검증에서 확인):**
- **(a) PostgREST 쿼리 `db().from()`** — 대부분. Drizzle 쿼리로 전환(서브 C).
- **(b) 저장 프로시저 `db().rpc("fn", …)` — 12곳**(artworks 4, cards 3, requests 2, admin-data/reports/storage 각 1). `01_app.sql`의 plpgsql 함수. Drizzle `db.execute(sql\`select * from fn(…)\`)`로 전환(서브 C, 다른 패턴).
- **(c) 오브젝트 스토리지 `db().storage.*` — 13곳**(storage.ts 11, cleanup.ts 2). **서브 C 범위 밖 → 서브 D.** 서브 C에서는 얇은 임시 스토리지 클라이언트(`lib/storage-client.ts`, `@supabase/supabase-js` 유지)로 **격리만** 한다.

- **소스(22파일):** `lib/{admin,admin-data,artists,members,artworks,cards,search,favorites,comments,reviews,community,engagements,reports,requests,ranking,storage,cleanup,art-requests,artist-stats}.ts`, `app/api/{events,avatars/[userId],download/[id],search-requests}/route.ts` (**API 라우트 4개**).
- **테스트/헬퍼(~19곳):** `tests/integration/*`, `tests/helpers/fixtures.ts`, `tests/e2e/db.ts` 등 — C3에서 함께 전환. fixtures/일부 통합 테스트의 **업로드 경로는 스토리지(서브 D) 의존** → 그 부분은 stub/blocked.

### 3.5 세션/미들웨어
- **`middleware.ts` 없음.** `proxy.ts`가 Next 16의 요청 라우팅/세션 리프레시 담당(`session()` 함수, 56행 `getUser()`). `/admin/*`·`/artist/*` 가드 + `/artist/callback`·`/admin/login` 예외. `visitor_id` 쿠키(1년) 부여 — **유지.**

### 3.6 RDS 스키마(이미 적용됨)
- `infra/db/00_authjs.sql` — Auth.js 어댑터 테이블(**uuid 커스텀**): `users(id uuid default gen_random_uuid(), email unique, name, image, emailVerified, password_hash, created_at)`, `accounts(id, userId→users.id, provider, providerAccountId, access_token/refresh_token/expires_at/id_token/scope)`, `sessions(...)`(JWT 전략이라 미사용), `verification_token`.
- `infra/db/01_app.sql` — 앱 테이블. admins/artists/members/engagements/comments/posts/requests 가 `user_id uuid → users.id on delete cascade`. **RLS on, 정책 없음**(service_role=서버만 접근).

### 3.7 환경변수(현행)
`.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`(어드민 로그인용), `SUPABASE_SECRET_KEY`(service_role, 데이터), `SUPABASE_DB_URL`(테스트용 PG 접속).

### 3.8 로컬 Docker 현황(2026-11-01 확인)
- 실행 중: `supabase_db_pokeca`(PG17, **54322**) 등 Supabase 스택 전체 healthy. 타 프로젝트 컨테이너(5433/3304/3306/4572)와 무관.
- **포트 5432 비어 있음** → 신규 Postgres용으로 사용. repo에 `docker-compose.yml` 없음(신규 추가).

---

## 4. 목표 아키텍처

### 4.1 신규/변경 파일
1. **`auth.ts`(루트, 신규)** — Auth.js 설정. `providers: [Kakao, Google, Credentials]`, `adapter: DrizzleAdapter(db)`, `session: { strategy: "jwt" }`, `callbacks.jwt`/`callbacks.session`(세션에 `user.id`·역할 주입), `profile()`(카카오/구글 이름·이메일 매핑), `pages`(에러/로그인 경로 커스텀). `export { handlers, auth, signIn, signOut }`.
2. **`app/api/auth/[...nextauth]/route.ts`(신규)** — `export const { GET, POST } = handlers`. OAuth 콜백 `/api/auth/callback/{kakao,google}` 자동 제공.
3. **`lib/db/index.ts`(신규)** — Drizzle 클라이언트 `db`(node-postgres 드라이버, `DATABASE_URL`). 싱글턴.
4. **`lib/db/schema.ts`(신규)** — `infra/db/00_authjs.sql`+`01_app.sql`을 Drizzle 테이블로 미러(단일 출처는 여전히 `infra/db/*.sql`; schema.ts는 타입/쿼리용 미러).
5. **auth 헬퍼 재작성** — `lib/admin.ts`·`lib/artists.ts`·`lib/members.ts`: Supabase `getUser()` → `auth()`(Auth.js) 세션, `db().from()` → Drizzle.
6. **서버액션 재작성** — `app/artist/actions.ts`: `socialLogin`→`signIn("kakao"|"google")`, `logout`→`signOut()`. `app/admin/actions.ts`: `login`→`signIn("credentials",{redirect:false,...})`, `logout`→`signOut()`.
7. **`app/artist/callback/route.ts` 삭제** — Auth.js 콜백이 대체.
8. **`proxy.ts` 세션 체크 재작성** — Supabase `getUser()` → Auth.js `auth()`(JWT). `visitor_id` 로직 유지.
9. **데이터 접근 134곳** — Drizzle 쿼리로 전환.
10. **`lib/supabase/{auth,server}.ts` 삭제 + `@supabase/ssr` 제거**(C3). ⚠️ `@supabase/supabase-js`는 **스토리지(`lib/storage-client.ts`)가 서브 D 전까지 사용**하므로 유지.

### 4.2 데이터 흐름
- **소셜 로그인:** 버튼 → `signIn("kakao")` → 카카오 리다이렉트 → `/api/auth/callback/kakao` → Auth.js가 `users`/`accounts` upsert(Drizzle adapter) → JWT 쿠키 발급 → `auth()` 세션에 `user.id`.
- **어드민 로그인:** 이메일/비번 → `signIn("credentials")` → `authorize()`에서 `users.password_hash` **bcrypt 검증** → JWT.
- **권한:** `admins` 조회로 역할 판정. **플랜에서 먼저 고정할 것**(이게 `auth.ts`의 jwt/session 콜백 모양을 결정하므로 구현 중 발견 금지): 기본안 = `requireAdmin`에서 매번 `admins` 조회(단순, JWT에 role 미포함). 조회 비용이 문제되면 jwt 콜백에서 role 1회 심기로 전환.

### 4.3 환경변수(목표)
`AUTH_SECRET`, `AUTH_KAKAO_ID`/`AUTH_KAKAO_SECRET`, `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, `DATABASE_URL`(로컬 Docker `postgres://...@localhost:5432/...` → 배포 시 RDS). Auth.js v5는 `AUTH_*` 규약을 자동 인식. `.env.example` 갱신.

---

## 5. 작업 단계 (각 단계 끝에 `npm run typecheck` 녹색)

- **C0 — 토대:** Drizzle(`drizzle-orm`, `drizzle-kit`, `pg`) 설치·설정, `lib/db/`(client+schema), `docker-compose.yml`(Postgres 5432) + `infra/db/*.sql` 적용 + 시드. Drizzle `db` 연결 스모크.
- **C1 — 인증 코어:** `auth.ts` + `app/api/auth/[...nextauth]/route.ts` + env. Kakao/Google/Credentials 설정. auth 헬퍼(`admin.ts`/`artists.ts`/`members.ts`)·서버액션(artist/admin)·`proxy.ts` 재작성. auth 인접 데이터 접근(admins/artists/members)만 Drizzle. `app/artist/callback/route.ts` 삭제. **목표: 로컬에서 로그인 end-to-end 동작.**
- **C2 — 데이터 계층 나머지:** 남은 ~120 `db()` 사이트를 도메인별로 Drizzle 전환(artworks/cards/search/comments/community/favorites/reviews/engagements/reports/requests/ranking/storage/cleanup/art-requests/artist-stats + `app/api/*`). 시드 스크립트(`scripts/seed-*.mts`, `demo:*`)도 `DATABASE_URL` 기반으로 갱신.
- **C3 — 정리:** `@supabase/ssr`·`@supabase/supabase-js` 제거, `lib/supabase/` 삭제, `.env.example` 정리, `tests/e2e/db.ts` Auth.js 기반 갱신, 전체 타입체크·테스트 녹색.

---

## 6. 외부 의존 / 사용자 액션

- **카카오/구글 개발자 콘솔 콜백 URL 추가** — `http://localhost:3000/api/auth/callback/{kakao,google}`(로컬) + (서브 A에서) 프로드 도메인. 기존 Supabase용 OAuth 앱 **재사용 가능**(콜백만 추가). 기존 client id/secret 확보 필요.
  - **진행 방식:** 카카오 콘솔 세팅이 필요한 시점에 **사용자에게 먼저 알린다 → 사용자가 ego-lite(ego-browser)로 직접 처리.**

---

## 7. 테스트 전략

- 로컬 Docker Postgres 대상 통합 테스트: 로그인(각 provider; 소셜은 목/수동), `requireAdmin`/`requireArtist` 가드, 핵심 데이터 CRUD 스모크.
- 기존 `tests/e2e/db.ts:115`(Supabase 로그인) → Auth.js 기반으로 갱신.
- 각 단계(C0~C3) 종료 시 `npm run typecheck` 통과 필수. 최종 `npm test`/`test:e2e` 녹색.

---

## 8. 위험 / 함정

1. ~~Next 16 + Auth.js v5 호환~~ → ✅ 확인됨(peer deps).
2. **카카오 프로필 매핑** — 카카오는 이름/이메일 필드가 구글·Supabase와 다름(`kakao_account.profile.nickname`, 이메일 동의 범위). `profile()` 콜백으로 정규화.
3. **134곳 전환 분량** — C2에서 도메인별로 쪼개고 각 전환 후 타입체크. 한 번에 몰지 않음.
4. **`proxy.ts`(Next 16 미들웨어 대체) Auth.js 연동** — JWT 세션을 미들웨어 레벨에서 읽기. Edge 런타임 제약 주의: **C1 초반에 값싼 확인 — 미들웨어 경로는 JWT만 읽고 Drizzle/node-postgres(어댑터=Node 전용) import가 없어야 함**(있으면 Edge에서 깨짐). 이 확인이 auth 가드 계층 전체를 디리스크.
5. **로컬 Postgres ↔ RDS 스키마 드리프트** — 단일 출처 `infra/db/*.sql` 유지. Drizzle `schema.ts`는 미러이며, 변경 시 둘 다 반영.
6. **RLS** — 현재 service_role로 우회 중. Drizzle은 마스터 유저로 직결 → 동일하게 RLS 우회(현재 OK). 앱 전용 DB 유저 도입 시 정책 재검토(범위 밖).
7. **bcrypt in serverless** — `bcryptjs`(순수 JS) 권장(네이티브 `bcrypt` 빌드 이슈 회피). 어드민 비번 해시 생성 스크립트 1개 필요.
8. **JWT 세션 즉시 무효화 불가** — 로그아웃·역할박탈이 토큰 만료 전까지 유효. 어드민 수가 적고 런칭 전이라 수용. 필요 시 짧은 만료 + 재검증.

---

## 9. 성공 기준 (서브 C DoD)

- [ ] 로컬 Docker Postgres에서 카카오·구글·어드민 로그인이 **Auth.js**로 동작.
- [ ] 앱 데이터 접근(쿼리 `db().from()` + 저장프로시저 `db().rpc()`)이 **Drizzle**로 동작. **스토리지 `db().storage.*`는 서브 D로 이월**(얇은 클라이언트로 격리).
- [ ] `@supabase/ssr` + `lib/supabase/{auth,server}.ts` 제거. (`@supabase/supabase-js`는 스토리지용으로 서브 D까지 잔존.)
- [ ] `requireAdmin`/`requireArtist`/`currentMember` 등 가드가 세션 기반으로 정상.
- [ ] `npm run typecheck` 녹색, 핵심 테스트 통과.
- [ ] `infra/db/*.sql`가 스키마 단일 출처로 유지(Drizzle schema와 일치).

---

## 10. 범위 밖 (다른 서브)

- 서브 A: OpenNext/Lambda/CloudFront 배포, **NAT 인스턴스**(OAuth 토큰 교환=인터넷), 도메인/ACM(us-east-1), 시크릿 주입.
- 서브 D: S3 presigned 업로드 + CloudFront 서빙(Supabase Storage 교체).
- 서브 E: DNS 컷오버, 스모크, Vercel·Supabase 해지, (옵션) RDS Proxy.
