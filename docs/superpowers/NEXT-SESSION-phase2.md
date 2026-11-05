# 다음 세션 핸드오프 — AWS 이전 Phase 2 이어하기

> 이 파일만 읽으면 다음 세션에서 바로 이어갈 수 있다. 최종 갱신: 2026-11-02

## 0. 세션 시작하는 법 (복붙용 킥오프 프롬프트)

새 세션 열고 이거 그대로 붙여넣기:

```
art-poke AWS 이전 Phase 2 이어서 한다. docs/superpowers/NEXT-SESSION-phase2.md 와
docs/superpowers/specs/2026-11-01-aws-phase2-design.md 읽고,
서브 C(인증+데이터계층)·서브 D(스토리지 이전: Supabase Storage→S3)는 완료. 다음은 서브 A(앱 배포: OpenNext+Lambda+CloudFront)다. AWS는 반드시 --profile artpoke (계정 138681986450, 회사 gr-readonly 금지).
먼저 /gstack 으로 brainstorming→writing-plans 거쳐 진행.
```

시작 시 Claude가 확인할 것:
- `aws sts get-caller-identity --profile artpoke` → Account `138681986450` 인지 (아니면 중단)
- 작업 레포: `~/orca/projects/art-poke/pokeca` (인프라 worktree 아님). 브랜치 `feat/frontend-wire-migrate`

---

## 1. 지금까지 완료 (Phase 1 + Phase 2 서브 B)

- ✅ **Phase 1**: VPC·RDS(도쿄)·S3·ECR·Secrets·IAM·healthcheck Lambda. `DB OK` 검증(Lambda→RDS).
- ✅ **Cognito 제거** (Auth.js로 가기로 함).
- ✅ **서브 B (DB 스키마)**: RDS에 25개 테이블 적용 완료.
  - `infra/db/00_authjs.sql` (Auth.js 테이블, uuid), `infra/db/01_app.sql` (앱 스키마 변환본)
  - 적용 도구: **migration Lambda** `infra/lambda-migrate/` — `aws lambda invoke --function-name pokeca-migrate --profile artpoke --region ap-northeast-1 /tmp/o.json`
- 전부 커밋됨, `terraform plan = No changes`.
- ✅ **서브 C (인증 이전 + 데이터 계층 전환) 완료 (2026-11-02, 브랜치 `feat/aws-phase2-subC-auth`, PR 올림).**
  - **인증**: Supabase Auth → **Auth.js v5**(`next-auth@5.0.0-beta.32`). split-config(`auth.config.ts` 엣지 + `auth.ts` 노드), providers=Kakao/Google/Credentials(bcrypt), **JWT 세션**, `@auth/drizzle-adapter`. `proxy.ts`=엣지 auth 가드. 어드민 로그인 end-to-end 검증(curl).
  - **데이터 계층**: `db()`(Supabase PostgREST) **134곳 전부 → Drizzle ORM**(`@/lib/db`, node-postgres). `.rpc()`는 `db.execute(sql\`select fn(...)\`)`로 **같은 plpgsql 함수 호출 유지**. 23505는 `@/lib/db/errors`(`isUniqueViolation`, cause 체인 순회).
  - **검증**: `npm run typecheck`·`npm test`(135 pass/38 skip)·`npm run build` **전부 녹색**. 금칙 패턴(authClient/supabase server/db().from/.rpc/@supabase/ssr) grep=0.
  - **제거**: `lib/supabase/{auth,server}.ts`, `@supabase/ssr`. 스키마 단일 출처 `infra/db/*.sql` 유지.
  - **로컬 개발 DB**: Docker Postgres(5432) `docker-compose.yml` + `infra/db/*.sql`. 어드민 생성 `npm run admin:create -- <email> <pw>`. ⚠️ **테스트/시드는 Node 22 필요**(node 20이면 reseed 데모만 비치명 실패).
  - ⚠️ **서브 D로 이월된 것**: ① **스토리지** — `db().storage.*`는 `lib/storage-client.ts`(얇은 Supabase storage 래퍼)로 격리. `@supabase/supabase-js`·`NEXT_PUBLIC_SUPABASE_URL`·`SUPABASE_SECRET_KEY`는 그래서 **아직 남겨둠**(서브 D=S3 전환 때 제거). ② 스토리지 결합 통합테스트 4개 `describe.skip`(`// blocked until sub D`), `tests/helpers/fixtures.ts` 미이전. ③ 시드 스크립트(`scripts/seed-*.mts`, `demo:*`)는 아직 Supabase 대상 — 5432로 미이전(self-seeding 테스트로 대체).
  - ⚠️ **사용자 액션 대기(소셜 로그인 브라우저 검증)**: 카카오/구글 콘솔에 콜백 `http://localhost:3000/api/auth/callback/{kakao,google}` 등록 + `.env.local`에 `AUTH_KAKAO_ID/SECRET`·`AUTH_GOOGLE_ID/SECRET` 입력 필요 → ego-lite로. 어드민 로그인은 콘솔 불필요(이미 검증).
- ✅ **서브 D (스토리지 이전: Supabase Storage → S3) 완료 (2026-11-02, 브랜치 `feat/aws-phase2-subD-storage`).**
  - **스토리지 클라이언트**: `lib/storage-client.ts`를 `@aws-sdk/client-s3`+`s3-request-presigner`로 전면 재작성. 논리버킷(`artworks`/`consent-evidence`)→실 S3 버킷 매핑. export `uploadUrl/viewUrl/head/getRange/getObject/putObject/copy/remove/list/listWithMeta`.
  - **흐름**: 업로드=presigned PUT(클라 직접 fetch) → 서버 `promote`(HeadObject 크기 강제 + Range 매직바이트 검증 → copy+delete). 서빙=presigned GET. `viewUrl`은 한글 파일명을 RFC 5987(`filename*=UTF-8''`)로 인코딩(S3는 날 비ASCII content-disposition에 400을 돌려줌 — Supabase와 다름).
  - **인프라**: `infra/s3.tf`에 consent-evidence 버킷(+public-access-block·versioning), 두 버킷 CORS(dev origin)·lifecycle(pending/ 1일 만료) apply 완료. `terraform plan` No changes.
  - **테스트**: fixtures/e2e 스토리지 헬퍼를 S3 list/putObject/remove로 이전, `DATABASE_URL`(5432) 단일 DB 사용. skip 해제 10블록(artworks/cleanup/admin-actions/consent-evidence) 전부 실 S3 대상 녹색. `promote` 검증 통합테스트 신규.
  - **검증**: `npm run typecheck`·`AWS_PROFILE=artpoke npm test`(178 pass, exit 0, node v20.20.1)·`npm run build` **전부 녹색**.
  - **제거**: `@supabase/supabase-js`·`supabase` npm 제거, `db:start`/`db:reset` 스크립트 제거, `.env`의 `NEXT_PUBLIC_SUPABASE_URL`/`PUBLISHABLE_KEY`/`SECRET_KEY`/`SUPABASE_DB_URL` 제거. `supabase` grep=주석 + e2e artist 소셜가입(OAuth 콘솔 대기 skip)뿐.
  - ⚠️ **서브 A가 반드시 추가할 것(이 플랜 범위 밖)**: ① **CloudFront + OAC** — 작품 이미지 서빙을 CloudFront 도메인으로(현재는 presigned GET만, OAC로 S3 비공개 유지). ② **프로드 CORS origin** — `infra/s3.tf`의 CORS `allowed_origins`에 프로드 도메인 추가(현재 localhost만). ③ **Lambda S3 IAM 역할** — app Lambda 실행 역할에 두 버킷 Get/Put/Delete/List/Copy 권한 부여(로컬은 `AWS_PROFILE=artpoke`로 돌지만 프로드 Lambda는 IAM 역할 필요).
  - ⚠️ **여전히 이월**: 데모 시드 스크립트(`scripts/seed-*.mts`, `demo:*`)는 아직 Supabase 대상·node20에서 `.mts` 로딩 깨짐 → tsconfig 타입체크 제외. reseed teardown은 비치명 실패(테스트 exit code에 영향 없음). 통합테스트는 self-seeding + 로컬 DB에 카드 시드 복사로 동작.

## 2. 확정된 결정 (재논의 금지)

- 리전 **도쿄(ap-northeast-1)**, 상태버킷만 서울. 프로파일 **artpoke**.
- 앱 실행: **OpenNext + Lambda + CloudFront**
- 인증: **Auth.js(NextAuth)** — 카카오·구글·어드민(Credentials/bcrypt), 유저 **RDS**(Cognito 안 씀)
- 인가: **앱 레이어 if문 유지**(현 구조)
- 스토리지: **S3 + CloudFront(OAC)**
- 커넥션: Lambda 동시성 상한(초기), 압박 시 RDS Proxy
- NAT: **NAT 인스턴스(t4g.nano ~월3천원)** — NAT Gateway(4만원) 말고. (서브 A에서 필요: OAuth 토큰 교환이 인터넷으로 나가야 함)
- 전환: 빅뱅 컷오버 후 Vercel·Supabase 해지

## 3. 남은 작업 (순서대로)

### ✅ 서브 C — 인증 이전 + 데이터 계층 전환 (완료, 위 §1 참조)
설계 `docs/superpowers/specs/2026-11-01-aws-phase2-subC-auth-design.md`, 플랜 `docs/superpowers/plans/2026-11-01-aws-phase2-subC-auth.md`. 브랜치 `feat/aws-phase2-subC-auth` (PR). **다음 세션 1순위는 아래 서브 D(스토리지).** (아래는 원래 서브 C 대상 파일 기록 — 전부 전환됨.)
- ~~`lib/supabase/auth.ts`~~(삭제), `lib/admin.ts`, `lib/artists.ts`, `lib/members.ts` → Auth.js+Drizzle
- `app/artist/actions.ts`(→signIn/signOut), ~~`app/artist/callback/route.ts`~~(삭제, Auth.js가 대체), `app/artist/login/page.tsx`(그대로)
- `app/admin/actions.ts`(→Credentials), `app/admin/login/*`(그대로), `components/auth-menu.tsx`(그대로)
할 일:
1. `@auth/core` + next-auth v5 설치, `auth.ts` 설정(Kakao, Google, Credentials 공급자)
2. RDS 어댑터 연결(`@auth/pg-adapter` 또는 Drizzle) — users/accounts/sessions는 이미 RDS에 있음(00_authjs.sql)
3. `currentSocialUser()`·`requireAdmin()` 등을 Auth.js 세션 기반으로 재작성
4. 어드민 비번: bcrypt 해시 users.password_hash에 저장, Credentials authorize 검증
5. **카카오/구글 개발자 콘솔**: 콜백 URL을 `/api/auth/callback/{kakao,google}`로 추가(로컬+프로드)
6. env: `AUTH_SECRET`, `KAKAO_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `DATABASE_URL`
주의: 기존 `db()`(service_role 키)로 하던 데이터 접근은 RDS 직결(`DATABASE_URL`)로 바꿔야 함 — 이것도 서브 C/D에 걸침.

### ✅ 서브 D — 스토리지 이전 (완료, 위 §1 참조)
- 업로드=presigned PUT, 서빙=presigned GET, promote=head+range 검증. Supabase 완전 제거.
- **서브 A로 넘어간 잔여**: CloudFront(OAC)로 작품 이미지 서빙 + 프로드 CORS origin(`infra/s3.tf`) + app Lambda 실행 역할에 S3 권한. (위 §1 서브 D의 ⚠️ 항목 참조.)

### 데이터 이전 (🟢)
- 데이터 거의 없음. `npm run demo`(seed 스크립트)를 RDS 대상으로 돌리거나, Supabase에서 `pg_dump --schema=public --data-only` → migration Lambda/psql로 적재.
- **데모 시드 스크립트 포팅: `scripts/seed-*.mts`/`import-cards.mts`를 Supabase→pg(DATABASE_URL)+S3(putObject)로 이전 + `.mts` 로딩을 tsx로(현재 node20에서 깨짐). 현재 tsconfig 타입체크 제외 상태. `npm run demo` 복구 필요.** (서브 D는 끝났지만 시드 스크립트 포팅은 포함되지 않은 잔여 작업.)

### 서브 A — 앱 배포 (🔴)
- OpenNext 빌드 → Lambda(server)+S3(static)+CloudFront. (SST 또는 OpenNext CLI + Terraform)
- Lambda VPC 연결(RDS) + **NAT 인스턴스**(인터넷=카카오/구글 토큰).
- 도메인: **ACM 인증서는 us-east-1**(CloudFront 요건), CloudFront 대체도메인 + DNS 레코드.
- env/시크릿 주입.
- **서브 D 잔여(필수)**: ① 작품 이미지용 **CloudFront + OAC**(S3 비공개 유지한 채 서빙), ② `infra/s3.tf` CORS에 **프로드 도메인 origin 추가**(현재 localhost만), ③ **app Lambda 실행 역할에 S3 IAM 권한**(두 버킷 Get/Put/Delete/List/Copy) — 로컬은 `AWS_PROFILE=artpoke`로 돌지만 프로드 Lambda는 역할 필요.

### 서브 E — 컷오버 (🟢)
- 스모크(소셜로그인·업로드·어드민·주요플로우) → DNS를 CloudFront로 → Vercel·Supabase 해지.

## 4. 미해결/주의 (구현 전 결정 필요한 것)

- **공개 Function URL 403**: 신규계정 제한. 서브 A에서 CloudFront 세우면 자연 우회(해결 불필요).
- **NAT 필요**: VPC Lambda가 카카오/구글(인터넷) 호출하려면 NAT 인스턴스. 서브 A 착수 전 Terraform에 추가.
- **ACM us-east-1**: CloudFront용 인증서는 버지니아에 발급(리소스는 도쿄라도).
- **RLS on**: RDS는 마스터 유저로 접속하면 RLS 우회됨(현재 OK). 앱이 별도 DB 유저로 접속하게 바꾸면 RLS 정책 재검토.

## 5. 자주 쓰는 명령

```bash
# 항상 프로파일 + 계정 확인 먼저
aws sts get-caller-identity --profile artpoke   # Account=138681986450 여야 함

cd ~/orca/projects/art-poke/pokeca/infra
export AWS_PROFILE=artpoke
terraform plan            # 코드=실제 일치 확인(No changes 기대)

# 스키마 다시 적용(변경 시): db/*.sql 수정 → lambda-migrate/sql 갱신 빌드 → apply → invoke
cp db/*.sql lambda-migrate/sql/ && terraform apply
aws lambda invoke --function-name pokeca-migrate --profile artpoke --region ap-northeast-1 /tmp/o.json && cat /tmp/o.json

# DB 연결 테스트
aws lambda invoke --function-name pokeca-healthcheck --profile artpoke --region ap-northeast-1 /tmp/o.json && cat /tmp/o.json  # "DB OK"

# 비용 걱정되면 전체 내리기(스키마는 db/*.sql로 재생성 가능)
terraform destroy
```

## 6. 레포/문서 지도

- 인프라 코드: `infra/` (Terraform) · DB 스키마: `infra/db/`
- 설계: `docs/superpowers/specs/2026-10-31-aws-infra-phase1-design.md`, `.../2026-11-01-aws-phase2-design.md`
- 플랜: `docs/superpowers/plans/2026-10-31-aws-infra-phase1.md` (App Runner 기준—Lambda로 갱신 필요)
- 이슈·결정 기록: `docs/superpowers/2026-11-01-aws-infra-journey.md`
- 메모리(개인): `~/.claude/.../memory/art-poke-aws-migration.md`, `art-poke-aws-account-separation.md`

---

## ✅ 서브 A — 앱 배포 완료 (2026-11-05)

**프로덕션 LIVE: https://d3mfru6qnveki4.cloudfront.net** (브랜치 `feat/aws-phase2-subA-deploy`)

- 아키텍처: CloudFront(기본도메인) → **API Gateway HTTP API** → Lambda(OpenNext server/image), 정적=S3(OAC), DB=RDS(SSL), 아웃바운드=NAT 인스턴스(fck-nat t4g.nano).
- 검증: 홈/정적/SSR/API 200, **카카오·구글 로그인 end-to-end**(프로필 자동생성), POST(서버액션) 정상, terraform `No changes`.
- 프로드 RDS에 유저=작가 마이그레이션 적용·검증.
- 배포: `scripts/deploy.sh` (build→zip→apply→s3 sync→invalidation). 반드시 `AWS_PROFILE=artpoke`.
- 결정·함정 전부 기록: `docs/superpowers/2026-11-04-subA-deploy-decisions.md` (ADR-A1~A16).
  - 핵심 함정: 신규계정 공개 Function URL 403 + OAC POST 미서명 → **API Gateway 전환**(ADR-A15). sharp server fn 설치(A12). RDS SSL(A16).

### 서브 A 후속/남은 것
- **커스텀 도메인**: 도메인 등록(Route53) → ACM(us-east-1) + CloudFront alias + OAuth 콘솔에 프로드 도메인 추가. (현재 cloudfront.net)
- **API Gateway 직접접근 차단**(하드닝): CloudFront 커스텀 헤더 시크릿 + proxy.ts 검증. (현재 API GW 공개, 앞단 CloudFront)
- **어드민 프로드 시드**: 프로드 RDS에 어드민 계정 생성(어드민 로그인용).
- **작품 이미지 CloudFront+OAC**(서브 D 이월, 현재 presigned 유지).
- **데모 시드 Supabase→pg 포팅**(기존 과제).
- **서브 E 컷오버**: 커스텀 도메인 DNS 전환 후 Vercel/Supabase 해지.

### 서브 A 운영 주의 & 삽질 기록 → `docs/superpowers/2026-11-05-subA-gotchas.md`
Function URL 막다른 길(→API Gateway), sharp/archive_file/dummy캐시, RDS SSL, x-forwarded-host, **카카오 KOE006(리다이렉트 URI를 "카카오 로그인" 섹션에 — "비즈니스 인증" 아님; 앱→플랫폼키→REST API키 수정)**, OAuth 콘솔 자동화 교훈, 검증 체크리스트. 같은 삽질 반복 금지용.

### ⚠️ 알려진 미해결 버그: 프로덕션 signout 미작동
`/api/auth/signout` 후에도 세션 유지(로그인·세션읽기는 정상). 가설=청크된 authjs 세션쿠키의 다중 Set-Cookie가 CloudFront/API Gateway 거치며 일부만 전달. 공용PC 로그아웃 안 됨(보안) → 우선순위 중. 조사 시작점은 gotchas 문서 §7.
