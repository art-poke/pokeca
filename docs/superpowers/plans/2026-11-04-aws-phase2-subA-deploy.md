# AWS Phase 2 서브 A — 앱 배포 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development 또는 superpowers:executing-plans. 단계는 체크박스(`- [ ]`).
> **인프라 플랜 특성**: "TDD" 대신 각 태스크 = (tf 작성 → `terraform plan`으로 의도 확인 → `apply` → 실측 검증). 각 apply 전 plan diff를 사람이 확인.

**Goal:** Next 16 앱을 OpenNext로 서버리스 배포(Lambda + CloudFront + S3)하여 `*.cloudfront.net`으로 라이브. 소셜로그인·업로드·어드민 end-to-end 동작.

**Architecture:** CloudFront(기본 도메인) → 정적=S3(OAC), 그 외=OpenNext server Lambda(Function URL). Lambda는 VPC(프라이빗)에서 RDS 직결 + NAT 인스턴스로 OAuth 아웃바운드.

**Tech Stack:** `@opennextjs/aws` v4, Terraform(기존 `infra/`), AWS(ap-northeast-1, profile artpoke=138681986450), Next 16.4.3 / Auth.js v5(JWT) / Drizzle.

**설계·결정:** `specs/2026-11-04-aws-phase2-subA-deploy-design.md`, `2026-11-04-subA-deploy-decisions.md`

**공통 안전 수칙(모든 AWS 명령):** `export AWS_PROFILE=artpoke` 먼저. `aws sts get-caller-identity`로 **138681986450** 확인(아니면 즉시 중단, 회사 gr-readonly 금지). `cd infra` 작업.

---

## 파일 구조 (만들 것 / 고칠 것)
- `open-next.config.ts` (신규, 레포 루트) — OpenNext 설정(최소)
- `infra/nat.tf` (신규) — 퍼블릭 서브넷 + IGW + NAT 인스턴스 + 라우트
- `infra/app.tf` (신규) — OpenNext server/image Lambda + assets S3 버킷 + Function URL
- `infra/cloudfront.tf` (신규) — CloudFront 배포 + OAC + 비헤이비어
- `infra/iam.tf` (수정) — 앱 Lambda 역할에 S3/Secrets 권한
- `infra/secrets.tf` (수정) — 앱 시크릿(AUTH_* 등)
- `infra/variables.tf`/`outputs.tf` (수정) — 변수/출력(cloudfront 도메인 등)
- `infra/errored.tfstate` (삭제) — 과거 실패 잔재(무해)
- `.gitignore` — `.open-next/` 추가
- `scripts/deploy.sh` (신규) — build+sync+apply 래퍼

---

## Phase 0 — 선행 정리 + 프로드 DB 마이그레이션

### Task 0.1: 상태 정합 확인 + 잔재 정리
- [ ] **Step 1** `export AWS_PROFILE=artpoke && aws sts get-caller-identity` → Account **138681986450** 확인.
- [ ] **Step 2** `cd infra && terraform plan -input=false` → **No changes** 확인(이미 검증됨).
- [ ] **Step 3** `git rm --cached infra/errored.tfstate 2>/dev/null; rm -f infra/errored.tfstate` + `.gitignore`에 `infra/errored.tfstate`·`.open-next/` 추가.
- [ ] **Step 4: Commit** `chore(subA): 상태 잔재 정리 + .gitignore`

### Task 0.2: 프로드 RDS에 유저=작가 마이그레이션 적용
- [ ] **Step 1** `cp infra/db/*.sql infra/lambda-migrate/sql/` (01_app.sql에 `20261103000000_user_is_artist` 블록 포함 확인).
- [ ] **Step 2** `cd infra && terraform apply` (migrate Lambda zip 갱신분만) → plan에 lambda-migrate 소스 변경만.
- [ ] **Step 3** `aws lambda invoke --function-name pokeca-migrate --region ap-northeast-1 /tmp/o.json && cat /tmp/o.json` → 성공(idempotent ALTER).
- [ ] **Step 4: 검증** migrate Lambda 로그/결과로 `artists` 컬럼에 avatar_path 있고 status 없음, members 없음 확인(또는 healthcheck 쿼리).
- [ ] **Step 5: Commit** `db(subA): 프로드 RDS 유저=작가 마이그레이션 적용`

---

## Phase 1 — OpenNext 빌드 파이프라인 (인프라 전, 로컬에서 산출물 확인)

### Task 1.1: OpenNext 설치 + 설정 (리뷰 C1/H3)
- [ ] **Step 1** **Next 16 지원 정확 버전 핀**: `@opennextjs/aws`의 [compatibility](https://opennext.js.org/aws/compatibility) 확인 후 Next 16.4 지원 버전으로 설치(`@^4`만으론 Next16 미지원 버전 설치 위험). **단, 4.1.0은 피함**(스트리밍 wedge 버그 #1315) → 패치 버전(4.1.x+ 또는 4.0.x). 설치된 정확 버전을 결정로그에 기록.
- [ ] **Step 2** 레포 루트 `open-next.config.ts` — **art-poke는 cacheComponents off=거의 전동적이라 ISR/revalidate 인프라(Dynamo/SQS/cache S3)를 dummy로 끈다**(안 끄면 런타임이 Dynamo/SQS 기대 → 에러):
```ts
import type { OpenNextConfig } from "@opennextjs/aws/types/open-next";
const config: OpenNextConfig = {
  default: {
    override: {
      incrementalCache: "dummy", // ISR/revalidate 안 씀 → cache S3·revalidation fn 불필요
      queue: "dummy",            // revalidation SQS 불필요
      tagCache: "dummy",         // revalidateTag/DynamoDB 불필요
    },
  },
  // 이미지 최적화: <img>+presigned 위주. 기본 유지(필요 시 조정).
};
export default config;
```
> ⚠️ 주의: 앱에서 `revalidatePath`/`revalidateTag`/ISR을 쓰는 곳이 있으면 dummy가 깨뜨린다. Task 1.2에서 grep 확인.
- [ ] **Step 3** `.gitignore`에 `.open-next/` 추가(0.1에서 했으면 skip). `middleware는 server fn 내부 번들(external 안 씀)` — proxy.ts는 별도 함수 아님(기본값).

### Task 1.2: 로컬 빌드 산출물 검증
- [ ] **Step 0** ISR/revalidate 사용처 grep: `grep -rnE "revalidatePath|revalidateTag|export const revalidate|next: \{ revalidate" app lib components` → 있으면 Task 1.1 dummy 결정 재검토.
- [ ] **Step 1** `AWS_PROFILE=artpoke npx open-next build` → `.open-next/` 생성.
- [ ] **Step 2: 검증** `.open-next/`에 `server-functions/default`(handler=`index.handler`, `index.mjs` re-export), `assets/`(루트에 `_next/static/...` 포함), `open-next.output.json` 존재. dummy로 꺼도 `revalidation-function/`·`dynamodb-provider/`·`warmer-function/`은 **생성될 수 있으나 배포 불필요**(dummy라 런타임 미사용) — 배포 대상은 server fn + assets만.
- [ ] **Step 3** `open-next.output.json`에서 **런타임/핸들러/오리진 경로**를 읽어 Task 3.2/4.1 tf에 반영. (기본 런타임 nodejs24.x — Lambda runtime 이 값과 일치시킬 것. node20 쓰려면 의도 명시.)
- [ ] **Step 4: Commit** `build(subA): OpenNext 설치·설정(dummy 캐시), 빌드 산출물 확인`

---

## Phase 2 — 네트워크(퍼블릭 + NAT 인스턴스)

### Task 2.1: 퍼블릭 서브넷 + IGW + NAT 인스턴스
**Files:** `infra/nat.tf`(신규), `infra/vpc.tf`(라우트 참조 조정 시)
- [ ] **Step 1** `infra/nat.tf` 작성:
  - `aws_subnet.public[2]`(AZ a/c, map_public_ip), `aws_internet_gateway`, 퍼블릭 라우트테이블(0.0.0.0/0→IGW) + 연결.
  - NAT 인스턴스: **fck-nat AMI 권장**(`data.aws_ami` owner=568608671756, name 필터로 **최신 패치 AMI 동적 조회** — ⚠️ fck-nat 1.4.0-20260701은 CVE-2026-98432(커널 UAF) 영향, 패치 버전 핀 필수). `t4g.nano`, public subnet, `source_dest_check=false`, SG(프라이빗 CIDR 인바운드 all, 아웃바운드 all), EIP 연결.
  - 프라이빗 라우트테이블 0.0.0.0/0 → NAT 인스턴스 ENI.
- [ ] **Step 2** `terraform plan` → 신규 리소스만(기존 변경 없음) 확인.
- [ ] **Step 3** `terraform apply`.
- [ ] **Step 4: 검증** healthcheck Lambda(프라이빗) 재호출 또는 임시 테스트로 **아웃바운드 인터넷** 확인(예: migrate Lambda에서 외부 호출, 또는 NAT 인스턴스 상태 running+2/2).
- [ ] **Step 5: Commit** `infra(subA): 퍼블릭 서브넷+IGW+NAT 인스턴스(t4g.nano)`

> 대안 메모: NAT user_data iptables가 번거로우면 **fck-nat** 커뮤니티 AMI 사용(권장). 플랜 구현 시 택1.

---

## Phase 3 — 앱 Lambda + assets S3

### Task 3.1: assets S3 버킷
**Files:** `infra/app.tf`
- [ ] **Step 1** `aws_s3_bucket.assets`(이름 `pokeca-assets-138681986450`) + public_access_block(전차단) + (OAC로만 접근).
- [ ] **Step 2** `terraform apply` → 버킷 생성.
- [ ] **Step 3: Commit** `infra(subA): OpenNext assets S3 버킷`

### Task 3.2: server Lambda (env 직접 주입 포함 — 리뷰 M2/M3/H2)
**Files:** `infra/app.tf`, `infra/iam.tf`
- [ ] **Step 1** `data.archive_file`로 `.open-next/server-functions/default` → zip. `aws_lambda_function.app_server`:
  - **runtime = open-next.output.json 값과 일치**(기본 nodejs24.x; node20 쓰려면 결정로그 명시), handler `index.handler`, 메모리 1024, timeout 30.
  - VPC(프라이빗 서브넷 + lambda SG).
  - **환경변수를 생성 시점에 직접 주입**(Secrets 별도 Phase 금지 — 그래야 DB 페이지 즉시 동작):
    - `DATABASE_URL = "postgresql://${user}:${urlencode(pass)}@${aws_db_instance.main.address}:${port}/${dbname}"` (lib/db가 `DATABASE_URL` 읽음 확인됨; `random_password.db`는 special=false라 인코딩 이슈 없음)
    - `AUTH_SECRET`(신규 `random_password`/시크릿), `AUTH_KAKAO_ID/SECRET`, `AUTH_GOOGLE_ID/SECRET`
    - **`AUTH_TRUST_HOST = "true"`** (CloudFront+Lambda 뒤 host 신뢰 필수). `AUTH_URL`은 **이 단계에선 생략**(CloudFront 도메인 미정 — 순환). 호스트는 Phase 4의 CloudFront Function이 넣는 `x-forwarded-host`로 해결. 필요 시 Phase 6에서 `AUTH_URL` 2차 주입.
    - `S3_BUCKET_UPLOADS`, `S3_BUCKET_EVIDENCE` (⚠️ `AWS_REGION`은 Lambda 예약 env라 주입 금지 — 런타임이 자동 제공. storage-client는 이 값을 읽음)
  - `aws_lambda_function_url`: **`invoke_mode = "RESPONSE_STREAM"`**(스트리밍 SSR; BUFFERED면 스트리밍 깨짐), `authorization_type = "AWS_IAM"`(Phase 4에서 CloudFront OAC가 sigv4 서명). 
- [ ] **Step 2** `infra/iam.tf`: 앱 역할에 **S3 uploads/evidence 버킷만**(Get/Put/Delete/List/Copy, 리소스 ARN+`/*`로 좁힘) + logs + VPC. **assets 버킷 읽기 불필요**(CloudFront OAC가 직접 읽음 → 제외). **Secrets read 불필요**(env 직접 주입).
- [ ] **Step 3** `terraform plan` → Lambda/IAM 신규 확인. `apply`.
- [ ] **Step 4: 검증** Function URL은 AWS_IAM이라 직접 curl 401 정상. `aws lambda invoke`로 핸들러 구동 확인, 또는 임시로 auth NONE 두고 **DB 접근 경로(`/api/auth/session` 200, DB 쿼리 페이지)** 확인 후 AWS_IAM로 전환. (정적은 CloudFront 전이라 깨짐 정상.)
- [ ] **Step 5: Commit** `infra(subA): OpenNext server Lambda(env 직접주입·RESPONSE_STREAM) + IAM(S3 uploads/evidence)`

---

## Phase 4 — CloudFront + OAC

### Task 4.1: CloudFront 배포 (리뷰 C2/H1/M1/M4)
**Files:** `infra/cloudfront.tf`
> ⚠️ aws provider 현재 `5.100.0`(~>5.70). **Lambda 오리진 OAC는 2026-10 신기능** — 5.100이 지원 안 하면 provider 상향 필요. plan 1스텝에서 `aws_cloudfront_origin_access_control`의 `origin_access_control_origin_type = "lambda"` 지원 확인(미지원 시 provider 버전 bump).
- [ ] **Step 1: x-forwarded-host CloudFront Function (필수 — 없으면 Auth.js 콜백·세션 전멸)**
  - `aws_cloudfront_function`(viewer-request): `event.request.headers["x-forwarded-host"] = { value: event.request.headers.host.value }` 세팅. OpenNext 서버가 이 헤더로 host를 잡음(Lambda가 받는 Host는 Lambda 호스트명이라 그대로 쓰면 깨짐).
- [ ] **Step 2: 오리진/비헤이비어**
  - OAC 2개: (a) **Lambda용**(origin type=lambda, sigv4), (b) **S3 assets용**(sigv4).
  - 오리진: (a) Lambda Function URL(custom origin, https-only, OAC), (b) S3 assets(OAC).
  - **기본 비헤이비어 → Lambda**: viewer-request에 위 Function associate. **`Host`는 origin으로 forward 금지**(Function URL이 자기 호스트 기대) — 대신 x-forwarded-host로 전달. **쿠키 전달**: origin request policy로 `__Secure-authjs.session-token` 등 Auth.js 쿠키 + CSRF 쿠키 origin 전달, **캐시 키에서 쿠키 제외**(캐시 오염 방지). 캐시 정책=CachingDisabled(또는 min, `Cache-Control` 존중). `Set-Cookie` viewer 반환 허용.
  - **정렬 비헤이비어 → S3 assets**: `/_next/static/*`, 정적 확장자(OpenNext output 규칙). 장기 캐시.
  - `viewer_certificate { cloudfront_default_certificate = true }` (커스텀 도메인 X).
  - S3 assets 버킷 정책: 이 distribution OAC만 `s3:GetObject`.
- [ ] **Step 3** `terraform plan` → CloudFront/Function/OAC/정책 신규. `apply`(전파 수 분).
- [ ] **Step 4: assets 업로드 (경로·캐시헤더 분리 — M4)** deploy.sh로:
  - `aws s3 sync .open-next/assets s3://pokeca-assets-138681986450/` (**버킷 루트** — assets가 이미 `_next/static/...` 포함. `/_next/...` prefix 이중화 금지)
  - 해시 파일: `--cache-control "public,max-age=31536000,immutable"`, 비해시: `public,max-age=0,s-maxage=31536000,must-revalidate` (2회 sync 또는 메타 분리)
  - (dummy incrementalCache라 `.open-next/cache` **S3 업로드 불필요**)
- [ ] **Step 5: 검증** `curl https://<dist>.cloudfront.net/` → 홈 SSR 렌더 + `/_next/static/...` 200 + 캐시 헤더. `curl -I`로 x-forwarded-host 경유 정상(리다이렉트 Location이 cloudfront 도메인인지).
- [ ] **Step 6: Commit** `infra(subA): CloudFront + OAC(Lambda/S3) + x-forwarded-host Function, assets sync`

---

## Phase 5 — AUTH_URL 확정 + env 최종 검증
> 시크릿/DB env는 **Phase 3에서 Lambda 생성 시 직접 주입**됨(M2 반영). 여기선 CloudFront 도메인이 생긴 뒤 host 관련 마무리만.

### Task 5.1: AUTH_URL 세팅(선택) + 세션 검증
**Files:** `infra/app.tf`(env)
- [ ] **Step 1** CloudFront 도메인 확정 후, 안전을 위해 Lambda env에 `AUTH_URL = "https://<dist>.cloudfront.net"` 추가 주입(`AUTH_TRUST_HOST=true`와 병행). `terraform apply`.
- [ ] **Step 2: 검증** cloudfront.net에서 `/api/auth/session` 200(JSON), 어드민 로그인 폼 로드, DB 페이지(카드 검색) 정상. 로그인 리다이렉트 Location이 **cloudfront 도메인**인지(x-forwarded-host 동작 확인).
- [ ] **Step 3: Commit** `infra(subA): AUTH_URL 세팅 + 세션/호스트 검증`

---

## Phase 6 — OAuth 프로드 등록 + end-to-end 스모크

### Task 6.1: 카카오·구글 콘솔에 cloudfront.net 리다이렉트 등록 (사용자+ego)
- [ ] **Step 1** 배포 도메인 확정(`terraform output cloudfront_domain`).
- [ ] **Step 2** ego-lite로 카카오/구글 콘솔에 `https://<dist>.cloudfront.net/api/auth/callback/{kakao,google}` + JS origin 추가(기존 localhost 유지).
- [ ] **Step 3** Auth.js host 설정은 Phase 3(`AUTH_TRUST_HOST=true`)+Phase 5(`AUTH_URL`)에서 이미 주입됨 — 여기선 x-forwarded-host 경유 콜백 URL이 cloudfront 도메인으로 생성되는지만 재확인.

### Task 6.2: end-to-end 스모크
- [ ] **Step 1** ego로 cloudfront.net 접속 → 카카오 로그인 → `/me` 프로필 자동생성 → handle 설정 → 도안 업로드(S3 presigned) → 카드페이지 공개 확인.
- [ ] **Step 2** 구글 로그인 동일 확인.
- [ ] **Step 3** 어드민 로그인(Credentials) → 작품 관리/신고 화면.
- [ ] **Step 4** S3 주고받기(업로드 파일 다운로드) 정상.
- [ ] **Step 5: Commit** `deploy(subA): OAuth 프로드 등록 + end-to-end 스모크 통과`

---

## Phase 7 — 마무리

### Task 7.1: 배포 스크립트 + 문서
- [ ] **Step 1** `scripts/deploy.sh`: `open-next build` → `aws s3 sync` assets → `terraform apply` → CloudFront invalidation(`/_next/*` 제외 SSR 경로).
- [ ] **Step 2** 핸드오프 문서(`NEXT-SESSION-phase2.md`) 갱신: 서브 A 완료, 남은 건 커스텀 도메인/서브 E/시드 포팅.
- [ ] **Step 3** 결정 로그에 실제 구현 중 바뀐 선택 반영(예: fck-nat 채택, Function URL 제한 방식).
- [ ] **Step 4: Commit** `chore(subA): 배포 스크립트 + 핸드오프/결정로그 갱신`

---

## DoD
- [ ] `https://<dist>.cloudfront.net` 라이브: 홈/정적/SSR/API 200.
- [ ] 카카오·구글 로그인 → 프로필 자동생성 → handle → 업로드 → 공개, 어드민 로그인 전부 통과.
- [ ] 프로드 RDS에 유저=작가 마이그레이션 적용됨.
- [ ] `terraform plan = No changes`. 결정 로그/핸드오프 최신화.

## 범위 밖(후속)
- 커스텀 도메인 + ACM(us-east-1) + Route 53 DNS.
- 작품 이미지 CloudFront+OAC 서빙(1차 presigned 유지).
- 서브 E 컷오버(Vercel/Supabase 해지), 데모 시드 Supabase→pg 포팅.

## 리스크 (리뷰 반영)
- **[최중요] x-forwarded-host**: CloudFront viewer-request Function 없으면 Auth.js 콜백/세션 전멸(C2). Task 4.1 Step1 필수.
- **Lambda 오리진 OAC**: 2026-10 정식 지원(커스텀 헤더 폴백 불필요). 단 aws provider 5.100이 지원하는지 Task 4.1에서 확인, 미지원 시 provider bump.
- **스트리밍 wedge 버그**: `@opennextjs/aws` 4.1.0 + CloudFront + RESPONSE_STREAM 회귀(#1315) → Task 1.1에서 4.1.0 회피 버전 핀, Task 4.1 스모크에 스트리밍 응답 확인.
- **dummy 캐시**: ISR/revalidate 쓰는 코드 있으면 깨짐 — Task 1.2 Step0 grep으로 확인.
- NAT: fck-nat AMI **CVE-2026-98432** → 패치 AMI 동적 조회/핀. 단일 인스턴스 SPOF는 저트래픽 수용.
- 쿠키/캐시 정책: Auth.js 세션 쿠키 origin 전달 + 캐시 키 제외(캐시 오염 방지) — Task 4.1 Step2.
- runtime nodejs24(OpenNext 기본) vs node20 — 택하면 결정로그 명시.
