# AWS 이전 Phase 2 — 결정사항 & 이슈 기록 (서브 C 인증 + 서브 D 스토리지)

- 기간: 2026-11-01 ~ 2026-11-02
- 범위: Phase 2 = 실제 앱 이전. 서브 B(DB 스키마, 완료) → **서브 C(인증 Supabase Auth→Auth.js + 데이터계층 db()→Drizzle)** → **서브 D(스토리지 Supabase Storage→S3)**.
- 결과: ✅ 서브 C·D 완료, **main 머지(PR #1·#2)**. typecheck/test/build 녹색. 남음: 서브 A(배포)·E(컷오버).
- Phase 1 로그: `2026-11-01-aws-infra-journey.md` (이 문서의 전편).
- 상세 설계/플랜: §4 문서 지도 참고.

---

## 1. 내린 결정 (결정 로그)

### 서브 C — 인증 + 데이터 계층
| # | 결정 | 선택 | 이유 / 대안 |
|---|---|---|---|
| C1 | 인증 라이브러리 | **Auth.js v5**(next-auth 5 beta) ← Cognito 폐기 | 앱이 카카오·구글 소셜 실사용. Cognito는 카카오 내장 IdP 없음(OIDC 수동, 함정↑)+유저 미러 테이블 필요+락인. Auth.js는 카카오·구글 1급 내장, 유저 RDS 직접 저장, $0, Next 네이티브 |
| C2 | 공급자 | Kakao·Google(OAuth) + **Credentials(어드민, bcrypt)** | 현 signInWithPassword 대체 |
| C3 | 세션 전략 | **JWT** (DB 세션 아님) | **Auth.js Credentials는 JWT 세션에서만 동작**(제약). 어드민이 Credentials라 강제됨. `sessions` 테이블 미사용 |
| C4 | DB 도구(ORM) | **Drizzle** ← Prisma/Kysely/pg 검토 | 사용자가 "보편적"이면 Prisma지만, 서버리스(Lambda) 경량·커넥션 수월 + 타입강함 + 기존 `.from().eq()`와 매핑 자연스러움으로 Drizzle 선택 |
| C5 | 어댑터 | **@auth/drizzle-adapter** | C4와 일치 |
| C6 | 데이터계층 범위 | **db() 134곳 전부 Drizzle로(인증과 동시)** | auth 헬퍼가 user_id로 앱테이블 즉시 조회 → 인증만 RDS로 가면 두 DB split-brain. "users는 RDS" 확정 결정과 FK 때문에 분리 불가 |
| C7 | 데이터 이전 | **새로 시작**(유저 이전 없음) | 런칭 전·실데이터 없음. 어드민 bcrypt 재생성, 나머지 재시드 |
| C8 | 로컬 개발 DB | **Docker Postgres(5432)** | RDS 비공개 VPC라 로컬 직결 불가. `docker-compose.yml`+`infra/db/*.sql` |
| C9 | 실행 방식 | brainstorming→writing-plans→subagent 구동(spec+코드품질 2단계 리뷰) | 리뷰가 실버그 다수 차단(§2) |

### 서브 D — 스토리지
| # | 결정 | 선택 | 이유 / 대안 |
|---|---|---|---|
| D1 | 업로드 | **presigned PUT(클라 직접)** + 서버 promote 검증 ← 서버 프록시 거부 | 배포가 Lambda(바디 ~6MB 한계)인데 작품 최대 100MB → 파일이 서버 통과하면 터짐. 게다가 현 코드가 이미 클라-직접(createSignedUploadUrl) → S3 presigned 1:1 |
| D2 | PUT vs POST | **PUT + promote HeadObject 검증** ← POST content-length-range 대안 | 단순·현 구조 1:1. 용량 하드강제는 promote의 head 크기검증 + lifecycle/rate-limit로 커버 |
| D3 | 서빙 | **presigned GET** (CloudFront는 서브 A) | 서브 D는 S3 교체에만 집중. CloudFront(OAC)+ACM+도메인은 배포와 함께 |
| D4 | 기존 객체 | **이전 안 함(재업로드)** | 런칭 전 |
| D5 | 로컬/테스트 자격 | **실 S3 dev + AWS_PROFILE=artpoke** | presigned 생성에 자격 필요. LocalStack은 선택적 폴백 |
| D6 | 버킷 토폴로지 | **별도 버킷 2개**(uploads + consent-evidence) | 현 코드가 BUCKET/EVIDENCE_BUCKET 논리 분리 |

---

## 2. 겪은 이슈 (이슈 로그) — 대부분 서브에이전트 리뷰가 선제 차단

| # | 이슈 | 원인 | 해결 |
|---|---|---|---|
| J1 | 23505(unique) 감지 실패 | **Drizzle는 pg 에러를 `DrizzleQueryError`로 감싸 실제 code가 `.cause`에 있음**(top-level 아님) | `@/lib/db/errors`의 `isUniqueViolation`/`pgErrorCode`(cause 체인 순회) 공유 헬퍼 |
| J2 | 통합테스트 로드 실패 `Cannot find module 'next/server'` | lib가 `@/auth`→next-auth→`next/server`를 끌어와 vitest(비-Next)에서 해석 실패 | 테스트 상단 `vi.mock("@/auth")`로 세션 목킹 |
| J3 | 로컬 DB 2개 스키마 비호환 | **5432(신규)=public.users, FK→public.users** ↔ **54322(Supabase)=auth.users** — 둘이 다른 세계. 54322엔 데이터 있고 5432는 비어있음 | 개발·테스트 **5432로 단일화**, 테스트는 self-seeding. 데이터는 5432에 카드 시드 복사 |
| J4 | "db() 134곳"이 전부 PostgREST 아님 | `.rpc()` 12곳(저장프로시저) + `.storage.*` 13곳(오브젝트 스토리지) 섞임 | rpc→`db.execute(sql\`select fn(...)\`)`로 **plpgsql 그대로 호출**. storage→서브 D로 이월(lib/storage-client.ts 격리) |
| J5 | DrizzleAdapter 커스텀 스키마 타입 충돌 | 우리 스키마의 `expires_at` bigint·`sessionToken` text-unique·uuid id가 어댑터 기본(integer/pk)과 다름 | 발산 테이블만 좁게 캐스트(`accounts`/`sessions as any`), users/verificationTokens는 타입체크 유지. JWT전략이라 런타임 무해 |
| J6 | Credentials + DB세션 조합 불가 | Auth.js 제약 | 세션 전략 JWT로 확정(C3) |
| J7 | proxy.ts(미들웨어) 엣지 안전 | 엣지 런타임은 node 전용(db/bcrypt/adapter) import 불가 | split-config: `auth.config.ts`(엣지, OAuth만) + `auth.ts`(노드, adapter+Credentials). proxy는 auth.config만 import |
| J8 | 테스트/시드 Node 20에서 깨짐 | `@supabase/supabase-js` realtime이 node20 WebSocket 없음 + `.mts`를 plain node가 로딩 못함 | 테스트는 **Node 22** 사용. 시드 스크립트는 이월(debt) |
| J9 | S3 presigned GET 다운로드 400 | **한글 파일명을 content-disposition에 날로 넣으면 S3가 400**(Supabase는 허용했음) | `viewUrl`에서 RFC 5987(`filename*=UTF-8''…`)+ASCII 폴백 인코딩 |
| J10 | S3 PUT은 용량 하드캡 안 함 | presigned PUT 특성 | `promote`에서 HeadObject로 `size ≤ maxBytesOf(kind)` 검증이 유일 강제점(신규) |
| J11 | git push 403 | **gh 활성 계정이 leeyunjae7로 드리프트**(권한 없음), SSH 키도 거기 묶임. 정상 계정=clyde-yoonjae | push 전 `unset GH_TOKEN GITHUB_TOKEN; gh auth switch --user clyde-yoonjae` (한 셸에서) |
| J12 | zsh가 `$VAR` 공백분리 안 함 | zsh 기본(SH_WORD_SPLIT off) — `--profile artpoke`가 한 토큰으로 | aws 명령에 플래그 인라인, 또는 `${=VAR}` |
| J13 | 시드 스크립트 Supabase 의존 잔존 | `scripts/seed-*.mts`가 아직 @supabase 사용 + node20 .mts 깨짐 | **tsconfig 타입체크 제외(debt 명시)**, `npm run demo` 복구 필요 — 포팅(pg+S3+tsx)은 잔여작업 |

---

## 3. 최종 아키텍처 (Phase 2 서브 C+D 후)

```
브라우저
  │  로그인: Auth.js(/api/auth/*) — Kakao/Google(OAuth) + Credentials(bcrypt), JWT 쿠키
  │  업로드: createUpload로 presigned PUT URL 받음 → 파일을 S3에 직접 PUT → promote(검증)
  ▼
Next.js 앱(현재 로컬; 배포는 서브 A)
  │ 데이터: Drizzle(@/lib/db, node-postgres) → Postgres (로컬 5432 / 배포 RDS)
  │ 스토리지: lib/storage-client.ts(@aws-sdk/client-s3) → S3 (presigned PUT/GET, promote=head+range)
  │ 세션/가드: proxy.ts(엣지 auth.config)
  ▼
Postgres(users/accounts + 앱테이블, FK→users) · S3(pokeca-uploads / pokeca-consent-evidence, 비공개+CORS+lifecycle)
```
- 제거됨: Supabase Auth, Supabase PostgREST(db()), Supabase Storage, `@supabase/*`.
- 스키마 단일 출처: `infra/db/*.sql` (Drizzle `lib/db/schema.ts`는 미러).

---

## 4. 문서 지도 (인수인계 — 이거 읽으면 됨)

| 목적 | 경로 |
|---|---|
| **다음 세션 시작점(필독)** | `docs/superpowers/NEXT-SESSION-phase2.md` |
| Phase 1 결정·이슈 로그 | `docs/superpowers/2026-11-01-aws-infra-journey.md` |
| **Phase 2 결정·이슈 로그(이 문서)** | `docs/superpowers/2026-11-02-aws-phase2-journey.md` |
| Phase 2 전체 설계 | `specs/2026-11-01-aws-phase2-design.md` |
| 서브 C 설계 / 플랜 | `specs/2026-11-01-aws-phase2-subC-auth-design.md` · `plans/2026-11-01-aws-phase2-subC-auth.md` |
| 서브 D 설계 / 플랜 / 사전결정 | `specs/2026-11-02-aws-phase2-subD-storage-design.md` · `plans/2026-11-02-aws-phase2-subD-storage.md` · `2026-11-02-subD-storage-decisions.md` |
| 인프라 코드 | `infra/*.tf` (s3/rds/vpc/iam/lambda/secrets/ecr/backend) · 스키마 `infra/db/*.sql` · 마이그 람다 `infra/lambda-migrate/` |
| PR | #1(서브 C), #2(서브 D) — 둘 다 main 머지됨 |

---

## 5. 남은 작업 (순서 · 무엇을 · 무엇을 참고)

### 데이터 이전 🟢 (작음)
- RDS에 스키마(서브 B 완료) + `npm run demo`/재업로드. 단 **데모 시드 스크립트 포팅 필요**(J13).
- 참고: `infra/db/*.sql`, `infra/lambda-migrate/`.

### 서브 A — 앱 배포 🔴 (가장 큼, 다음 1순위)
- **OpenNext로 Next.js 빌드 → Lambda(server)+S3(static)+CloudFront** 배포(Terraform or OpenNext/SST).
- **Lambda VPC 연결**(RDS 접근) + **NAT 인스턴스**(카카오/구글 토큰 교환=인터넷 필요).
- **도메인+ACM**(CloudFront용 인증서는 **us-east-1**) + CloudFront 대체도메인 + DNS.
- **env/시크릿 주입**: AUTH_SECRET, AUTH_KAKAO/GOOGLE, DATABASE_URL, S3_BUCKET_*.
- **⚠️ 서브 D가 넘긴 필수 3개**: ① **CloudFront+OAC**로 작품 이미지 서빙(S3 비공개 유지), ② `infra/s3.tf` CORS에 **프로드 도메인 origin 추가**(현재 localhost만), ③ **app Lambda 실행역할에 S3 IAM**(두 버킷 Get/Put/Delete/List/Copy — 로컬은 profile로 되지만 프로드 Lambda는 역할 필요).
- **카카오/구글 콘솔에 프로드 콜백 URL** 추가(`https://<도메인>/api/auth/callback/{kakao,google}`).
- 참고: `specs/2026-11-01-aws-phase2-design.md`(서브 A 포인트), Phase 1 journey(VPC/Lambda/NAT 교훈), `infra/`.

### 서브 E — 컷오버 🟢
- 스모크(소셜로그인·업로드·어드민·주요플로우) → DNS를 CloudFront로 → **Vercel·Supabase 해지**.

### 잔여 debt (언젠가)
- 데모 시드 스크립트 Supabase→pg+S3+tsx 포팅(J13), `npm run demo` 복구.
- 소셜 로그인 **브라우저 end-to-end 검증**(카카오/구글 콘솔 세팅 후 — 서브 C는 어드민만 curl 검증).
- `infra/healthcheck/` App Runner 잔재 정리 여부(Phase 1 숙제).

---

## 6. 핵심 교훈 (Phase 2)
1. **"X를 Y로 바꾼다"가 실제론 여러 겹**: 인증 교체가 데이터계층 전체 전환을 끌고 옴(C6). db()가 PostgREST만이 아니라 rpc/storage 섞여 있었음(J4). 착수 전 호출부를 분류하라.
2. **ORM/SDK의 에러·반환 래핑을 믿지 마라**: Drizzle의 `.cause`(J1), S3의 content-disposition 400(J9), S3 PUT 용량 미검증(J10) — 라이브러리마다 다르다. 테스트로 확인.
3. **서버리스 제약이 설계를 정한다**: Lambda 6MB 바디 → presigned 직업로드(D1). 엣지 런타임 → split-config(J7).
4. **리뷰(spec+코드품질)가 값을 했다**: J1·J4·J5·J9 등 실버그를 구현 전/중 차단. 혼자 짰으면 런타임에서 터졌을 것.
5. **환경 함정**: gh 계정 드리프트(J11), zsh 워드스플릿(J12), Node 버전(J8) — 인수인계 시 명시.
</content>
