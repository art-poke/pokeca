# 서브 C — 인증 이전(Auth.js) + 데이터 계층 RDS 전환(Drizzle) 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** pokeca 앱의 인증을 Supabase Auth → Auth.js v5로, 데이터 접근을 Supabase PostgREST(`db()`) → Drizzle ORM(Postgres 직결)로 전환해, 로컬에서 카카오·구글·어드민 로그인 + 전체 앱이 Postgres(Drizzle)로 동작하게 한다.

**Architecture:** Auth.js v5 split-config(엣지 안전 `auth.config.ts` + 노드 `auth.ts` with Drizzle 어댑터·Credentials). 세션은 **JWT**(Credentials 제약). 데이터 접근은 `lib/db`(Drizzle + node-postgres)로 통일. 로컬은 Docker Postgres(5432), 스키마 단일 출처는 `infra/db/*.sql`.

**Tech Stack:** Next 16.4.3 / React 19.3.0, `next-auth@5.0.0-beta.32`, `@auth/drizzle-adapter`, `drizzle-orm` + `pg`, `bcryptjs`, vitest(통합), playwright(e2e), Docker Postgres.

**작업 레포/브랜치:** `~/orca/projects/art-poke/pokeca`. 베이스 브랜치 `feat/frontend-wire-migrate`. 이 플랜은 그 위에 `feat/aws-phase2-subC-auth` 브랜치를 파서 진행.

**AWS 주의:** 이 플랜은 로컬 개발만 다룬다. AWS 호출이 필요하면 **반드시 `--profile artpoke`(계정 138681986450)**. 배포는 서브 A.

**사용자 액션(카카오/구글 콘솔):** C1에서 OAuth 콜백 URL 등록이 필요한 시점에 **작업을 멈추고 사용자에게 알린다 → 사용자가 ego-lite로 직접 등록**. 등록 전까지 소셜 로그인 수동 테스트는 보류(어드민 로그인은 콘솔 불필요하므로 먼저 검증).

---

## 전체 파일 구조 (생성/수정 맵)

### 생성
- `docker-compose.yml` — 로컬 Postgres(5432)
- `auth.config.ts` — 엣지 안전 Auth.js 설정(OAuth providers + 콜백 + pages). 어댑터·Credentials 없음.
- `auth.ts` — 노드 Auth.js(위 config + Drizzle 어댑터 + Credentials/bcrypt). `handlers/auth/signIn/signOut` export.
- `app/api/auth/[...nextauth]/route.ts` — `GET/POST = handlers`
- `lib/db/index.ts` — Drizzle 클라이언트(`db`)
- `lib/db/schema.ts` — Drizzle 스키마(auth 테이블 + 앱 테이블 미러; 단계별로 증가)
- `scripts/create-admin.mts` — 어드민 bcrypt 계정 생성 CLI
- `tests/integration/auth.test.ts` — Credentials authorize + currentAdmin/currentSocialUser 테스트
- `tests/db-smoke.test.ts` — C0 연결 스모크(임시, C0 끝나면 유지/삭제 택1)

### 수정
- `lib/admin.ts`, `lib/artists.ts`, `lib/members.ts` — auth 헬퍼: `authClient().auth.getUser()` → `auth()`, `db().from()` → Drizzle (C1에서 전체 전환)
- `app/artist/actions.ts`, `app/admin/actions.ts` — `signInWithOAuth`/`signInWithPassword`/`signOut` → `signIn`/`signOut`
- `proxy.ts` — Supabase 세션 → Auth.js 엣지 `auth()` (visitor 로직 유지)
- `.env.example`, 로컬 `.env.local` — `DATABASE_URL`, `AUTH_*` 추가 / Supabase 제거(C3)
- 나머지 18개 데이터 파일 + 4개 API 라우트(C2), 시드 스크립트·테스트 헬퍼(C2/C3)

### 삭제
- `app/artist/callback/route.ts` (C1, Auth.js가 대체)
- `lib/supabase/auth.ts`, `lib/supabase/server.ts`, `lib/supabase/` (C3)
- `@supabase/ssr` 의존성 (C3). ⚠️ `@supabase/supabase-js`는 스토리지용으로 **서브 D까지 유지**(삭제 안 함).

---

## 스테이지 C0 — 토대

### Task 0.0: 작업 브랜치
**Files:** (git)
- [ ] **Step 1: 브랜치 생성**
```bash
cd ~/orca/projects/art-poke/pokeca
git checkout feat/frontend-wire-migrate
git pull --ff-only 2>/dev/null || true
git checkout -b feat/aws-phase2-subC-auth
```
- [ ] **Step 2: 확인** — `git branch --show-current` → `feat/aws-phase2-subC-auth`

---

### Task 0.1: 로컬 Docker Postgres
**Files:** Create `docker-compose.yml`

- [ ] **Step 1: compose 작성**
```yaml
# docker-compose.yml — 로컬 개발용 Postgres (AWS RDS 대체). 포트 5432(호스트 비어 있음 확인됨).
services:
  db:
    image: postgres:17-alpine
    container_name: pokeca-dev-db
    environment:
      POSTGRES_USER: pokeca
      POSTGRES_PASSWORD: pokeca
      POSTGRES_DB: pokeca
    ports:
      - "5432:5432"
    volumes:
      - pokeca-dev-db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pokeca -d pokeca"]
      interval: 5s
      timeout: 3s
      retries: 10
volumes:
  pokeca-dev-db:
```
- [ ] **Step 2: 기동 + 헬스 대기**
```bash
docker compose up -d
until docker exec pokeca-dev-db pg_isready -U pokeca -d pokeca; do sleep 1; done
```
Expected: `accepting connections`
- [ ] **Step 3: 스키마 적용**(단일 출처 `infra/db/*.sql`, 순서 00→01)
```bash
docker exec -i pokeca-dev-db psql -U pokeca -d pokeca < infra/db/00_authjs.sql
docker exec -i pokeca-dev-db psql -U pokeca -d pokeca < infra/db/01_app.sql
docker exec pokeca-dev-db psql -U pokeca -d pokeca -c "\dt" | head -40
```
Expected: users/accounts/sessions/verification_token + 앱 테이블(artists/members/admins/artworks/...) 생성.
- [ ] **Step 4: 커밋**
```bash
git add docker-compose.yml && git commit -m "feat(subC): 로컬 개발용 Docker Postgres(5432)"
```

---

### Task 0.2: Drizzle + Auth.js 의존성 설치
**Files:** Modify `package.json`

- [ ] **Step 1: 런타임 의존성**
```bash
npm i next-auth@5.0.0-beta.32 @auth/drizzle-adapter drizzle-orm pg bcryptjs
```
- [ ] **Step 2: 개발 의존성**
```bash
npm i -D drizzle-kit @types/pg @types/bcryptjs
```
- [ ] **Step 3: 확인** — `node -e "require('next-auth');require('drizzle-orm');require('pg');require('bcryptjs')"` 무오류
- [ ] **Step 4: 커밋** — `git add package.json package-lock.json && git commit -m "feat(subC): Auth.js v5 + Drizzle + pg + bcryptjs 설치"`

> 메모: `pg`(node-postgres)를 채택(가장 보편적, @auth/drizzle-adapter 예제와 일치). `postgres`(postgres.js)가 devDeps에 이미 있으나 혼용하지 않는다.

---

### Task 0.3: Drizzle 스키마 — auth 테이블
**Files:** Create `lib/db/schema.ts`

> `00_authjs.sql`과 **정확히 일치**해야 한다(테이블/컬럼명). @auth/drizzle-adapter는 커스텀 스키마 객체를 받는다.

- [ ] **Step 1: 작성**
```ts
import {
  pgTable, uuid, text, timestamp, bigint, primaryKey,
} from "drizzle-orm/pg-core";

// --- Auth.js 어댑터 테이블 (00_authjs.sql 미러, uuid 커스텀) ---
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { withTimezone: true }),
  image: text("image"),
  passwordHash: text("password_hash"), // 어드민 Credentials용(bcrypt). 소셜은 null
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: bigint("expires_at", { mode: "number" }),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionToken: text("sessionToken").notNull().unique(),
  userId: uuid("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable("verification_token", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.identifier, t.token] }) }));
```
- [ ] **Step 2: 타입 확인** — `npx tsc --noEmit lib/db/schema.ts` (또는 전체 typecheck는 0.4 이후)
- [ ] **Step 3: 커밋** — `git add lib/db/schema.ts && git commit -m "feat(subC): Drizzle 스키마 — Auth.js 어댑터 테이블"`

> C1·C2에서 앱 테이블(admins/artists/members/… )을 이 파일에 **점진적으로 추가**한다. 각 추가 시 `infra/db/01_app.sql` 정의와 대조.

---

### Task 0.4: Drizzle 클라이언트
**Files:** Create `lib/db/index.ts`

- [ ] **Step 1: 작성**
```ts
import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// 단일 Pool. Lambda 동시성 상한으로 커넥션 보호(설계 P2-9). 로컬=Docker, 배포=RDS.
const g = globalThis as unknown as { __pgPool?: Pool };
const pool = g.__pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
if (process.env.NODE_ENV !== "production") g.__pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
```
- [ ] **Step 2: 커밋** — `git add lib/db/index.ts && git commit -m "feat(subC): Drizzle 클라이언트(node-postgres)"`

---

### Task 0.5: 환경변수
**Files:** Modify `.env.example`, 로컬 `.env.local`

- [ ] **Step 1: `.env.example`에 추가**
```bash
# --- AWS 이전(서브 C): Drizzle 직결 + Auth.js ---
# 로컬=Docker Postgres(5432), 배포=RDS
DATABASE_URL=postgresql://pokeca:pokeca@localhost:5432/pokeca
# openssl rand -base64 33 로 생성
AUTH_SECRET=
# 카카오/구글 OAuth 앱(기존 Supabase용 재사용 가능). Auth.js v5는 AUTH_* 자동 인식
AUTH_KAKAO_ID=
AUTH_KAKAO_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```
- [ ] **Step 2: 로컬 `.env.local` 실제 값 주입**
```bash
echo "DATABASE_URL=postgresql://pokeca:pokeca@localhost:5432/pokeca" >> .env.local
echo "AUTH_SECRET=$(openssl rand -base64 33)" >> .env.local
# AUTH_KAKAO_*/AUTH_GOOGLE_* 는 콘솔 값 확보 후(C1) 채운다
```
- [ ] **Step 3: 커밋** — `git add .env.example && git commit -m "feat(subC): DATABASE_URL·AUTH_* 환경변수"` (`.env.local`은 gitignore)

---

### Task 0.6: 연결 스모크 테스트 (TDD)
**Files:** Create `tests/db-smoke.test.ts`

- [ ] **Step 1: 실패 테스트 작성**
```ts
import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

describe("db smoke", () => {
  it("connects and selects users table", async () => {
    const r = await db.execute(sql`select count(*)::int as n from users`);
    expect(Array.isArray((r as any).rows)).toBe(true);
  });
});
```
- [ ] **Step 2: 실행 → 실패/통과 확인**
Run: `DATABASE_URL=postgresql://pokeca:pokeca@localhost:5432/pokeca npx vitest run tests/db-smoke.test.ts`
Expected: PASS(테이블 존재). 실패 시 Docker/스키마(0.1) 점검.
- [ ] **Step 3: 커밋** — `git add tests/db-smoke.test.ts && git commit -m "test(subC): Drizzle 연결 스모크"`

> `vitest`가 `@/` 별칭·`.env.local`을 읽는지 확인. 안 읽으면 `vitest.config.ts`에 `test.env`/alias 확인(기존 통합 테스트가 동작하므로 설정 존재).

**C0 DoD:** `npm run typecheck` 녹색, 스모크 테스트 통과.

---

## 스테이지 C1 — 인증 코어 (목표: 로컬에서 로그인 end-to-end)

### Task 1.1: `auth.config.ts` (엣지 안전)
**Files:** Create `auth.config.ts`

> 미들웨어(proxy.ts)가 import하므로 **노드 전용 코드 금지**(db/bcrypt/어댑터 import 금지). OAuth provider만.

- [ ] **Step 1: 작성**
```ts
import type { NextAuthConfig } from "next-auth";
import Kakao from "next-auth/providers/kakao";
import Google from "next-auth/providers/google";

export const authConfig = {
  providers: [Kakao, Google], // AUTH_KAKAO_ID/SECRET, AUTH_GOOGLE_ID/SECRET 자동 인식
  session: { strategy: "jwt" },
  pages: { signIn: "/artist/login" },
  callbacks: {
    // 로그인 직후 account.provider를 토큰에 심는다(소셜 판별용).
    async jwt({ token, account }) {
      if (account) token.provider = account.provider;
      return token;
    },
    // 세션에 user.id와 provider 노출.
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      (session as any).provider = token.provider;
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
```
- [ ] **Step 2: 타입 보강** — `types/next-auth.d.ts` 생성(`session.user.id`, `session.provider`):
```ts
import type { DefaultSession } from "next-auth";
declare module "next-auth" {
  interface Session { user: { id: string } & DefaultSession["user"]; provider?: string }
}
declare module "next-auth/jwt" {
  interface JWT { provider?: string }
}
```
- [ ] **Step 3: 커밋** — `git add auth.config.ts types/next-auth.d.ts && git commit -m "feat(subC): auth.config(엣지) — Kakao/Google + JWT 콜백"`

---

### Task 1.2: `auth.ts` (노드 — 어댑터 + Credentials)
**Files:** Create `auth.ts`

- [ ] **Step 1: 작성**
```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;
        const rows = await db
          .select({ id: users.id, email: users.email, hash: users.passwordHash })
          .from(users).where(eq(users.email, email)).limit(1);
        const u = rows[0];
        if (!u?.hash) return null;
        if (!(await bcrypt.compare(password, u.hash))) return null;
        return { id: u.id, email: u.email };
      },
    }),
  ],
});
```
- [ ] **Step 2: 타입체크** — `npm run typecheck` (DrizzleAdapter 스키마 매핑 타입 에러 없어야 함)
- [ ] **Step 3: 커밋** — `git add auth.ts && git commit -m "feat(subC): auth.ts(노드) — Drizzle 어댑터 + Credentials(bcrypt)"`

---

### Task 1.3: Auth.js route 핸들러
**Files:** Create `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: 작성**
```ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```
- [ ] **Step 2: dev 서버 기동 확인** — `npm run dev` 후 `curl -s localhost:3000/api/auth/providers` → kakao/google/credentials JSON. (끝나면 dev 종료)
- [ ] **Step 3: 커밋** — `git add app/api/auth && git commit -m "feat(subC): Auth.js route handler"`

---

### Task 1.4: `lib/db/schema.ts`에 C1 앱 테이블 추가
**Files:** Modify `lib/db/schema.ts`

> `infra/db/01_app.sql`의 정의를 대조해 추가. 아래는 Explore/소스 기준 컬럼(정확한 타입·널 여부는 01_app.sql 확인 후 맞출 것).

- [ ] **Step 1: admins/artists/members/favorites 추가**
```ts
import { pgTable, uuid, text, timestamp /* , 필요한 타입 */ } from "drizzle-orm/pg-core";

export const admins = pgTable("admins", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const artists = pgTable("artists", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  provider: text("provider").notNull(),
  intro: text("intro"),
  linkUrl: text("link_url"),
  status: text("status").notNull(), // pending|approved|rejected
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: text("reviewed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable("members", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  nickname: text("nickname").notNull(),
  avatarPath: text("avatar_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
// favorites 등 members 경로에서 참조하는 테이블도 anyMember()용으로 추가(01_app.sql 대조).
```
- [ ] **Step 2: 타입체크** — `npm run typecheck`
- [ ] **Step 3: 커밋** — `git add lib/db/schema.ts && git commit -m "feat(subC): Drizzle 스키마 — admins/artists/members"`

---

### Task 1.5: `lib/admin.ts` 재작성
**Files:** Modify `lib/admin.ts`

- [ ] **Step 1: currentAdmin → auth()+Drizzle, expectedConfirm → Drizzle**
```ts
import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { admins } from "@/lib/db/schema";
import { addEvidence, ArtworkError, setStatus } from "@/lib/artworks";

export type Admin = { userId: string; email: string };

export async function currentAdmin(): Promise<Admin | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const rows = await db.select({ userId: admins.userId, email: admins.email })
    .from(admins).where(eq(admins.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function requireAdmin(): Promise<Admin> {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login?denied=1");
  return admin;
}
// expectedConfirm(): artworks+cards 조인 → Drizzle. (01_app.sql의 artworks/cards 스키마 추가 필요 → C2 artworks에서 정의. C1에선 cards/artworks 테이블 정의를 schema.ts에 선행 추가하거나, expectedConfirm/applyAdminAction은 C2 artworks 전환과 함께 처리)
```
> **기본안(권장):** `expectedConfirm`/`applyAdminAction`은 `artworks`/`cards`(둘 다 rpc-heavy)에 의존하므로 **C1에선 손대지 말고** `currentAdmin`/`requireAdmin`만 Drizzle로. `expectedConfirm`/`applyAdminAction`은 **임시로 `db()`(Supabase) 유지** → Task 2.1(artworks)과 함께 전환. (혼용 허용, C3 전 정리.)
- [ ] **Step 2: 타입체크** — `npm run typecheck`
- [ ] **Step 3: 커밋** — `git commit -am "refactor(subC): admin.ts 인증 → Auth.js session + Drizzle"`

---

### Task 1.6: `lib/artists.ts` 재작성
**Files:** Modify `lib/artists.ts`

**`db()` 호출은 3종류다(이걸 먼저 분류하고 전환):**
- **(a) PostgREST 쿼리 `db().from()`** — 아래 표대로 Drizzle 쿼리로.
- **(b) 저장 프로시저 `db().rpc("fn", args)`** (총 12곳: artworks 4, cards 3, requests 2, admin-data/reports/storage 각 1) — `01_app.sql`의 plpgsql 함수 호출. Drizzle `db.execute(sql\`select * from fn(${a}, ${b})\`)`로. **다른 패턴·인자 바인딩 주의.**
- **(c) 오브젝트 스토리지 `db().storage.*`** (총 13곳: storage.ts 11, cleanup.ts 2) — Supabase Storage. **서브 C 범위 밖(서브 D).** Drizzle 대응 없음 → 전환하지 말고 **얇은 임시 Supabase 스토리지 클라이언트로 격리**(아래 Task 2.13 참고).

**PostgREST→Drizzle 패턴(이 파일에서 확립, C2에서 재사용):**
| 패턴 | Drizzle |
|---|---|
| `db().from("t").select(C).eq("a",v).maybeSingle()` | `db.select({...}).from(t).where(eq(t.a,v)).limit(1)` → `rows[0] ?? null` |
| `.insert(obj).select(C).single()` | `db.insert(t).values(obj).returning({...})` → `rows[0]` |
| `.update(patch).eq("a",v).select("x")` | `db.update(t).set(patch).where(eq(t.a,v)).returning({x:t.x})` |
| `.or("a.ilike.x,b.ilike.y")` | `or(ilike(t.a,x), ilike(t.b,y))` |
| `.order("c",{ascending:true}).limit(n)` | `.orderBy(asc(t.c)).limit(n)` |
| 에러코드 `23505`(unique) | ⚠️ **Drizzle는 pg 에러를 `DrizzleQueryError`로 감싸 실제 code가 `.cause`에 있음.** `err.code === "23505"` 직접 비교 금지 → **`import { isUniqueViolation, pgErrorCode } from "@/lib/db/errors"`** 사용(C1b에서 cause 체인 순회 헬퍼로 공유화됨). 현재 raw `error.code === "23505"` 쓰는 곳: favorites.ts, engagements.ts(×2), art-requests.ts — 전환 시 반드시 이 헬퍼로 교체. |
| **`db().rpc("fn", {a,b})`** | `import { sql } from "drizzle-orm"` → `const r = await db.execute(sql\`select * from fn(${a}, ${b})\`)` → `r.rows` |

- [ ] **Step 1: `currentSocialUser`를 Auth.js 세션으로**
```ts
import { auth } from "@/auth";
export async function currentSocialUser(): Promise<SocialUser | null> {
  const session = await auth();
  const user = session?.user;
  const provider = (session as any)?.provider as SocialProvider | undefined;
  if (!user?.id || !provider || !SOCIAL_PROVIDERS.includes(provider)) return null;
  return { id: user.id, email: user.email ?? null, provider, name: user.name ?? null };
}
```
- [ ] **Step 2: db() 사용 함수 전부 Drizzle로**(artistByUserId, anyApprovedArtist, registerArtist, listArtists, setArtistStatus, getArtistById, approvedArtistId, searchArtists, getPortfolio, listMyArtworks, withdrawMyArtwork). 위 패턴 적용. 조인(`artworks(count)`, `cards(...)`)은 Drizzle `leftJoin`/서브쿼리로. **artworks/cards 테이블 schema.ts 정의가 필요**하므로 이 시점에 추가(01_app.sql 대조).
> 분량이 크면 함수 단위로 쪼개 Step 2a/2b…로 나눠 각기 타입체크·커밋.
- [ ] **Step 3: 타입체크** — `npm run typecheck`
- [ ] **Step 4: 커밋** — `git commit -am "refactor(subC): artists.ts 전체 → Auth.js session + Drizzle"`

---

### Task 1.7: `lib/members.ts` 재작성
**Files:** Modify `lib/members.ts`
- [ ] **Step 1:** `currentMember`/`anyMember`/`updateProfile`/`artistDisplayName`의 `db().from()` → Drizzle(패턴 동일). `currentSocialUser`는 이미 artists.ts에서 전환됨.
- [ ] **Step 2: 타입체크** — `npm run typecheck`
- [ ] **Step 3: 커밋** — `git commit -am "refactor(subC): members.ts → Drizzle"`

---

### Task 1.8: 서버액션 재작성
**Files:** Modify `app/artist/actions.ts`, `app/admin/actions.ts`

- [ ] **Step 1: `app/artist/actions.ts`**
```ts
import { signIn, signOut } from "@/auth";
// socialLogin: provider 검증 후
export async function socialLogin(form: FormData) {
  const provider = String(form.get("provider"));
  if (!SOCIAL_PROVIDERS.includes(provider as SocialProvider)) redirect("/artist/login");
  await signIn(provider, { redirectTo: "/artist" }); // Auth.js가 콜백·세션 처리
}
export async function logout() { await signOut({ redirectTo: "/artist/login" }); }
// apply/withdraw 로직은 그대로(registerArtist/withdrawMyArtwork는 1.6에서 Drizzle화됨). authClient import 제거.
```
- [ ] **Step 2: `app/admin/actions.ts`**
```ts
import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      redirectTo: "/admin/artworks",
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: "이메일 또는 비밀번호가 맞지 않아요." };
    throw e; // redirect 예외는 재던지기
  }
  return null;
}
export async function logout() { await signOut({ redirectTo: "/admin/login" }); }
// recordLinkCheck/reviewArtist/attachReport/resolveReport: requireAdmin()는 유지. 내부 admin-data 호출은 C2.
```
> `signIn`의 리다이렉트는 내부적으로 `redirect()` 예외를 던진다. `AuthError`만 잡고 나머지는 재던져야 리다이렉트가 동작.
- [ ] **Step 3: 타입체크** — `npm run typecheck`
- [ ] **Step 4: 커밋** — `git commit -am "refactor(subC): 서버액션 로그인/로그아웃 → Auth.js signIn/signOut"`

---

### Task 1.9: 콜백 라우트 삭제
**Files:** Delete `app/artist/callback/route.ts`
- [ ] **Step 1:** `git rm app/artist/callback/route.ts`
- [ ] **Step 2: proxy.ts open 목록에서 `/artist/callback` 제거 예정(1.10에서 반영)**
- [ ] **Step 3: 커밋** — `git commit -m "refactor(subC): Supabase OAuth 콜백 라우트 삭제(Auth.js가 대체)"`

---

### Task 1.10: `proxy.ts` 재작성 (엣지 Auth.js)
**Files:** Modify `proxy.ts`

> **엣지 안전 확인(스펙 리스크 #4):** `auth.config`만 import(노드 db/bcrypt 없음). Drizzle/pg import 금지.

- [ ] **Step 1: 작성**
```ts
import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/auth.config";
import { isVisitorId, VISITOR_COOKIE } from "@/lib/visitor";

const { auth } = NextAuth(authConfig);

export const proxy = auth((request) => {
  const loggedIn = !!request.auth?.user;
  const { pathname } = request.nextUrl;

  const guard = (area: "/admin" | "/artist", open: string[]) => {
    if (loggedIn) return withVisitor(request);
    if (open.includes(pathname)) return withVisitor(request);
    const devStudioPreview =
      process.env.NODE_ENV !== "production" && area === "/artist" && !pathname.startsWith("/api/");
    if (devStudioPreview) return withVisitor(request);
    const login = request.nextUrl.clone();
    login.pathname = `${area}/login`; login.search = "";
    return NextResponse.redirect(login);
  };

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) return guard("/admin", ["/admin/login"]);
  if (pathname.startsWith("/artist/") || pathname === "/artist" || pathname.startsWith("/api/artist"))
    return guard("/artist", ["/artist/login"]); // /artist/callback 제거
  return withVisitor(request);
});

function withVisitor(request: NextRequest) {
  if (isVisitorId(request.cookies.get(VISITOR_COOKIE)?.value)) return NextResponse.next();
  const id = crypto.randomUUID();
  request.cookies.set(VISITOR_COOKIE, id);
  const res = NextResponse.next({ request: { headers: request.headers } });
  res.cookies.set(VISITOR_COOKIE, id, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365, path: "/",
  });
  return res;
}

export const config = { matcher: ["/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|woff2?)$).*)"] };
```
> Next 16의 `proxy` export 규약 확인. `auth((req)=>…)` 래퍼가 `req.auth`에 세션을 넣는다. JWT 전략이라 어댑터 없이 토큰만 읽어 엣지 안전.
- [ ] **Step 2: 엣지 번들 확인** — `npm run build` 시 proxy가 Edge에서 노드 모듈을 끌어오지 않는지(빌드 에러 없음). 에러나면 import 경로 점검.
- [ ] **Step 3: 커밋** — `git commit -am "refactor(subC): proxy.ts 세션 가드 → Auth.js 엣지 auth()"`

---

### Task 1.11: 어드민 생성 CLI
**Files:** Create `scripts/create-admin.mts`
- [ ] **Step 1: 작성**
```ts
import { Pool } from "pg";
import bcrypt from "bcryptjs";
const [email, password] = process.argv.slice(2);
if (!email || !password) { console.error("usage: tsx scripts/create-admin.mts <email> <password>"); process.exit(1); }
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const hash = await bcrypt.hash(password, 12);
const u = await pool.query(
  `insert into users (email, password_hash) values ($1,$2)
   on conflict (email) do update set password_hash = excluded.password_hash
   returning id`, [email, hash]);
const id = u.rows[0].id;
await pool.query(`insert into admins (user_id, email) values ($1,$2) on conflict (user_id) do nothing`, [id, email]);
console.log("admin ready:", email, id);
await pool.end();
```
- [ ] **Step 2: package.json 스크립트 추가** — `"admin:create": "node --env-file-if-exists=.env.local scripts/create-admin.mts"`
- [ ] **Step 3: 어드민 생성** — `npm run admin:create -- admin@pokeca.local 'testpw1234'` → `admin ready:` 출력
- [ ] **Step 4: 커밋** — `git add scripts/create-admin.mts package.json && git commit -m "feat(subC): 어드민 bcrypt 계정 생성 CLI"`

---

### Task 1.12: 인증 통합 테스트 (TDD)
**Files:** Create `tests/integration/auth.test.ts`
- [ ] **Step 1: 테스트 작성**(어드민 생성 → Credentials authorize 성공/실패 → currentAdmin)
```ts
import { describe, it, expect, beforeAll } from "vitest";
// create-admin 로직으로 admin@test 생성 후:
//  - 올바른 비번 → authorize가 {id,email} 반환
//  - 틀린 비번 → null
//  - currentAdmin(): auth() 목으로 session.user.id 주입 시 admins 매칭
```
> `auth()` 세션 목(mock)은 vitest `vi.mock("@/auth")`로 주입. authorize는 `auth.ts`에서 export하거나 테스트용으로 분리해 직접 호출.
- [ ] **Step 2: 실행** — `npx vitest run tests/integration/auth.test.ts` → PASS
- [ ] **Step 3: 커밋** — `git commit -am "test(subC): 인증(Credentials/currentAdmin) 통합 테스트"`

---

### Task 1.13: 로컬 로그인 수동 검증
- [ ] **Step 1: 어드민 로그인(콘솔 불필요)** — `npm run dev` → `/admin/login`에서 생성한 계정 로그인 → `/admin/artworks` 진입. 로그아웃 동작.
- [ ] **Step 2: 소셜 로그인(콘솔 필요) — STOP & ASK:** 카카오/구글 콜백 URL `http://localhost:3000/api/auth/callback/{kakao,google}` 등록이 필요. **사용자에게 알리고 ego-lite로 등록 요청.** 등록·`.env.local`에 `AUTH_KAKAO_*`/`AUTH_GOOGLE_*` 채운 뒤 로그인 → `/artist`(신청 전이면 `/artist/signup`) 진입 확인.
- [ ] **Step 3:** 문제 없으면 메모만 남기고 다음 스테이지.

**C1 DoD:** `npm run typecheck` 녹색, auth 통합 테스트 통과, 어드민 로그인 로컬 동작(+콘솔 등록 후 소셜 로그인 동작).

---

## 스테이지 C2 — 데이터 계층 나머지 Drizzle 전환

> **⚠️ 통합 테스트 로딩(next/server):** 기존 `tests/integration/*.test.ts`(artists/favorites/admin-actions 등)는 lib 파일이 `@/auth`→next-auth→`next/server`를 끌어와 vitest에서 **로드 실패**(`Cannot find module 'next/server'`)한다(C1a 이전부터 잠재, 이제 표면화). 각 도메인 테스트를 돌리기 전에 그 suite 상단에 **`vi.mock("@/auth")`**(auth.test.ts/artists-auth.test.ts 선례)로 세션을 목킹해 로드 가능하게 만들 것. (대안: vitest config에 `server.deps.inline`/alias로 next/server 중앙 처리 — 리스크↑, 비권장.)
>
> **방법:** Task 1.6의 PostgREST→Drizzle 패턴을 각 파일에 적용. **파일 1개 = 1 태스크 = 1 커밋**, 각 태스크 끝에 해당 도메인 통합 테스트 실행. 필요한 테이블은 전환 시 `lib/db/schema.ts`에 추가(01_app.sql 대조). 각 태스크 공통 스텝:
> 1. schema.ts에 이 도메인 테이블 추가(없으면)
> 2. 파일의 `db().from()` 전부 Drizzle로
> 3. `npm run typecheck`
> 4. 도메인 통합 테스트 실행(아래 매핑) → PASS
> 5. 커밋 `refactor(subC): <file> → Drizzle`

- [ ] **Task 2.1 `lib/artworks.ts`** (11곳, **rpc 4개**: artwork_create/set_status/add_evidence/attach_file 등) — 테스트 `tests/integration/artworks.test.ts`, `consent-evidence.test.ts`. **admin.ts의 expectedConfirm/applyAdminAction도 여기서 함께 Drizzle 전환**(C1에서 미룸). ⚠️ 이 도메인의 업로드/파일 경로 테스트는 스토리지(서브 D) 의존 → green 불가분 부분은 서브 D까지 blocked 표시.
- [ ] **Task 2.2 `lib/cards.ts`** (5, **rpc 3개**: search_cards_by_name/by_number/recent_artwork_cards) — `tests/integration/card-import.test.ts`, `search.test.ts`
- [ ] **Task 2.3 `lib/search.ts`** — `tests/integration/search.test.ts`
- [ ] **Task 2.4 `lib/favorites.ts`** (6) — `tests/integration/favorites.test.ts`
- [ ] **Task 2.5 `lib/comments.ts`** (6) — (관련 통합 테스트)
- [ ] **Task 2.6 `lib/reviews.ts`** (8) — `tests/integration/reviews.test.ts`
- [ ] **Task 2.7 `lib/community.ts`** (5)
- [ ] **Task 2.8 `lib/engagements.ts`** (4) — `tests/integration/engagements.test.ts`
- [ ] **Task 2.9 `lib/reports.ts`** (1, **rpc report_submit**) — `tests/integration/reports-requests.test.ts`
- [ ] **Task 2.10 `lib/requests.ts`** (5, **rpc 2개**: request_create/card_request_state) — `tests/integration/reports-requests.test.ts`
- [ ] **Task 2.11 `lib/art-requests.ts`** (5) — `tests/integration/art-requests.test.ts`
- [ ] **Task 2.12 `lib/ranking.ts`** (3)
- [ ] **Task 2.13 `lib/storage.ts`** (13곳 = `.from()`/`rpc` 소수 + **`db().storage.*` 11곳**) — ⚠️ **`db().storage.*`는 서브 D 소관, 전환 금지.** 처리:
  1. 얇은 임시 스토리지 클라이언트 `lib/storage-client.ts` 신설 — `@supabase/supabase-js`의 `createClient(url, SUPABASE_SECRET_KEY).storage`만 export(기존 `db().storage` 대체용). 서브 D에서 S3로 교체될 격리 지점.
  2. storage.ts의 `.from()`/`.rpc()`(있으면)만 Drizzle로, `.storage.*`는 새 클라이언트로 치환.
  3. 커밋 `refactor(subC): storage.ts 쿼리만 Drizzle, 스토리지 호출은 임시 격리(서브 D 대기)`
- [ ] **Task 2.14 `lib/cleanup.ts`** (5곳 = 쿼리 + **`db().storage.*` 2곳**) — 쿼리는 Drizzle, `.storage.*`는 Task 2.13의 `lib/storage-client.ts` 사용. `tests/integration/cleanup.test.ts`(스토리지 삭제 부분은 서브 D까지 blocked 가능).
- [ ] **Task 2.15 `lib/admin-data.ts`** (9, **rpc 1개**: artwork_set_link_status) — `tests/integration/admin-actions.test.ts`
- [ ] **Task 2.16 `lib/artist-stats.ts`** (1)
- [ ] **Task 2.17 API 라우트 4개** — `app/api/{events,avatars/[userId],download/[id],search-requests}/route.ts`
- [ ] **Task 2.18 시드 스크립트** — `scripts/seed-*.mts`, `import-cards.mts` 등(총 10개, 전부 `@supabase/supabase-js` 사용)을 `DATABASE_URL`/pg로. `npm run demo`가 로컬 Docker DB에 시드되는지 확인. ⚠️ 일부 시드는 **데모 이미지 업로드(sharp+storage)**를 함 → 스토리지 부분은 서브 D까지 **stub**(이미지 없이 메타만 시드) 처리.
- [ ] **Task 2.19 테스트 헬퍼** — `tests/helpers/fixtures.ts`(Supabase + 업로드 `uploadAsBrowser` 사용), `tests/integration/access-boundary.test.ts`를 Drizzle로. ⚠️ fixtures의 **업로드 경로는 스토리지(서브 D) 의존** → 해당 부분은 stub 또는 blocked. access-boundary는 RLS/service_role 전제 → Drizzle 직결 모델로 의미 재정의(앱 계층 접근 경계). `vitest.config.ts`가 2개 프로젝트(통합 + Storybook)임을 유의 — 새 통합 테스트가 올바른 프로젝트에 잡히는지 확인.

**C2 DoD:** 소스에서 `db().from()`/`db().rpc()` **0건**(`grep -rn 'db()' lib app` 결과가 **`.storage`만** 남음), `npm run typecheck` 녹색, 스토리지 비의존 통합 테스트 통과(**스토리지 의존 테스트는 "서브 D까지 blocked"로 명시적 표시**, green 게이트에서 제외), `npm run demo`가 로컬 Docker DB에 (이미지 제외) 시드 성공.

---

## 스테이지 C3 — 정리

### Task 3.1: Supabase **인증/데이터** 제거 (스토리지는 서브 D까지 잔존)
> ⚠️ `@supabase/supabase-js`는 **스토리지(`lib/storage-client.ts`)가 서브 D 전까지 사용**하므로 **지금 제거하지 않는다.** 인증용 `@supabase/ssr`과 데이터용 `lib/supabase/{auth,server}.ts`만 제거.
- [ ] **Step 1:** `lib/supabase/auth.ts`·`server.ts` 삭제(= `authClient`/`db()` 제거). `lib/supabase/`에 다른 파일 없으면 폴더 삭제. 잔존 import 확인(`grep -rn 'lib/supabase/auth\|lib/supabase/server' lib app tests` → 없음).
- [ ] **Step 2:** `npm rm @supabase/ssr` (※ `@supabase/supabase-js`는 남긴다 — 서브 D에서 S3 전환 후 제거).
- [ ] **Step 3: 타입체크/빌드** — `npm run typecheck && npm run build`
- [ ] **Step 4: 커밋** — `git commit -am "chore(subC): Supabase 인증(@supabase/ssr)·db() 제거 — 스토리지는 서브 D 대기"`

### Task 3.2: 환경변수 정리
- [ ] **Step 1:** `.env.example`에서 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_URL` 제거(테스트가 쓰면 `DATABASE_URL`로 대체). ⚠️ `NEXT_PUBLIC_SUPABASE_URL`·`SUPABASE_SECRET_KEY`는 **스토리지 클라이언트가 서브 D 전까지 사용**하므로 유지(주석으로 "스토리지 전용, 서브 D에서 제거" 표기). 로컬 `.env.local` 동기화.
- [ ] **Step 2: 커밋** — `git commit -am "chore(subC): env에서 Supabase 변수 제거"`

### Task 3.3: e2e 로그인 갱신
**Files:** Modify `tests/e2e/db.ts`(115행 signInWithPassword), `tests/e2e/*.spec.ts`
- [ ] **Step 1:** e2e 로그인 헬퍼를 Auth.js 기반으로(어드민: Credentials 폼 제출 or 세션 쿠키 주입; 작가: 테스트 유저 시드 + 세션). `supabase` import 제거.
- [ ] **Step 2: e2e 실행** — `npm run test:e2e` → 통과(로컬 Docker DB + dev 서버).
- [ ] **Step 3: 커밋** — `git commit -am "test(subC): e2e 로그인 Auth.js 기반으로 갱신"`

### Task 3.4: 최종 검증
- [ ] **Step 1:** `npm run typecheck` 녹색
- [ ] **Step 2:** `npm test` 녹색(스토리지 의존 테스트는 blocked 스킵 처리 명시)
- [ ] **Step 3:** `npm run test:e2e` 녹색(업로드 플로우는 서브 D까지 blocked)
- [ ] **Step 4:** 잔재 확인 — `grep -rn 'authClient\|lib/supabase/server\|db()\.from\|db()\.rpc' lib app --include='*.ts' --include='*.tsx'` → **없음**. (`db().storage`/`@supabase/supabase-js`는 스토리지용으로 서브 D까지 **의도적 잔존** — 이건 OK)
- [ ] **Step 5:** 수동 스모크(어드민·소셜 로그인 + 업로드 제외 핵심 플로우)
- [ ] **Step 6: 핸드오프 문서 갱신** — `docs/superpowers/NEXT-SESSION-phase2.md`에 서브 C 완료 반영, **잔존 스토리지 격리(`lib/storage-client.ts`, `@supabase/supabase-js`, `SUPABASE_*` env)를 서브 D 선결과제로 명시**, 다음=서브 D.

**C3 DoD = 서브 C DoD(스펙 §9, 스토리지 제외):** 로컬에서 카카오·구글·어드민 로그인이 Auth.js로 동작, 데이터 접근(쿼리+rpc) 전부 Drizzle, `@supabase/ssr`·`lib/supabase/{auth,server}.ts` 제거, typecheck/test/e2e 녹색(스토리지 의존 제외), `infra/db/*.sql`가 스키마 단일 출처. **스토리지(`db().storage`·`@supabase/supabase-js`)는 서브 D로 명시적 이월.**

---

## 위험 체크(실행 중 상시)
1. **DrizzleAdapter 스키마 매핑** — 어댑터가 기대하는 속성명(users.id/email/emailVerified/image, accounts.userId/provider/providerAccountId 등)이 schema.ts에 정확히 노출돼야. OAuth 첫 로그인 시 users/accounts insert 실패하면 매핑 점검.
2. **카카오 프로필 매핑** — 카카오는 이메일 동의 범위에 따라 email이 없을 수 있음. `currentSocialUser`는 email null 허용(기존도 그러함). 이름은 `session.user.name`(provider profile 기본). 부족하면 auth.config `callbacks.jwt`에서 `profile` 보강.
3. **signIn 리다이렉트 예외** — 서버액션에서 `signIn`/`signOut`은 `redirect()`를 던진다. `AuthError`만 잡고 재던지기.
4. **proxy.ts 엣지 안전** — `auth.config`에 노드 import 유입 금지. build/dev에서 Edge 에러 시 즉시 격리.
5. **access-boundary 테스트** — RLS 기본거부+service_role 전제였음. Drizzle 직결 모델에선 "서버만 접근" 보장 방식이 달라짐(앱 계층). 테스트 의미 재정의.
6. **혼용 기간** — C1~C2 중 일부 파일은 `db()`(Supabase), 일부는 Drizzle. 두 DB가 아니라 **같은 로컬 Docker Postgres 1개**를 보게 하려면: Supabase 로컬(54322)과 Docker(5432)가 다른 DB임에 주의. 전환 중 데이터 정합을 위해 **개발 DB를 Docker(5432) 하나로 통일**하고, 아직 `db()`인 코드도 로컬에선 Supabase 스택(54322)을 보므로, C2 완료 전까지는 "전환된 파일만 5432, 미전환은 54322"가 된다. → **권장: 혼용 기간 최소화를 위해 C2를 빠르게 끝내고, 통합 테스트는 전환된 도메인 단위로 5432 대상 실행.** (대안: Supabase 로컬 Postgres 54322를 그대로 Drizzle 대상으로 삼아 단일화—단 스키마는 infra/db/*.sql로 재적용 필요.)

> ⚠️ 리스크 #6은 실행 착수 시 **개발 DB 단일화 방식**을 먼저 확정할 것(Docker 5432 신규 vs 기존 Supabase Postgres 54322 재사용). 플랜은 Docker 5432 신규를 기본으로 하되, 혼용 창을 줄이도록 C1에서 auth 경로를, C2에서 나머지를 신속 전환.
