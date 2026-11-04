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

### Task 1.1: OpenNext 설치 + 설정
- [ ] **Step 1** `npm i -D @opennextjs/aws@^4` (Next 16 지원 버전 핀).
- [ ] **Step 2** 레포 루트 `open-next.config.ts` 작성(최소):
```ts
import type { OpenNextConfig } from "@opennextjs/aws/types/open-next";
const config: OpenNextConfig = {
  default: {}, // server fn 기본
  // 이미지 최적화는 <img>+presigned 위주라 기본값 유지(필요 시 imageOptimization 조정)
};
export default config;
```
- [ ] **Step 3** `.gitignore`에 `.open-next/` 추가(0.1에서 했으면 skip).

### Task 1.2: 로컬 빌드 산출물 검증
- [ ] **Step 1** `AWS_PROFILE=artpoke npx open-next build` → `.open-next/` 생성.
- [ ] **Step 2: 검증** `ls .open-next/` 에 `server-functions/`, `assets/`, (있으면)`image-optimization-function/`, `.open-next/open-next.output.json` 존재.
- [ ] **Step 3** 산출물 구조 기록(어떤 zip/디렉토리를 Terraform이 참조할지 플랜 Task 2.x에 반영).
- [ ] **Step 4: Commit** `build(subA): OpenNext 설치·설정, 빌드 산출물 확인`

---

## Phase 2 — 네트워크(퍼블릭 + NAT 인스턴스)

### Task 2.1: 퍼블릭 서브넷 + IGW + NAT 인스턴스
**Files:** `infra/nat.tf`(신규), `infra/vpc.tf`(라우트 참조 조정 시)
- [ ] **Step 1** `infra/nat.tf` 작성:
  - `aws_subnet.public[2]`(AZ a/c, map_public_ip), `aws_internet_gateway`, 퍼블릭 라우트테이블(0.0.0.0/0→IGW) + 연결.
  - NAT 인스턴스: 최신 AL2023 AMI(`data.aws_ami`), `t4g.nano`, public subnet, `source_dest_check=false`, SG(프라이빗 CIDR 인바운드 all, 아웃바운드 all), EIP 연결, user_data로 `iptables` MASQUERADE(또는 fck-nat AMI 사용).
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

### Task 3.2: server(+image) Lambda
**Files:** `infra/app.tf`, `infra/iam.tf`
- [ ] **Step 1** `data.archive_file`로 `.open-next/server-functions/default` → zip. `aws_lambda_function.app_server`:
  - runtime nodejs20.x(또는 OpenNext 권장), handler `index.handler`, 메모리 1024, timeout 30.
  - VPC(프라이빗 서브넷 + lambda SG), 환경변수(Phase 5 시크릿), `aws_lambda_function_url`(authorization_type NONE, 단 CloudFront만 접근하도록 Phase 4에서 제한).
  - (선택) image fn 동일 패턴.
- [ ] **Step 2** `infra/iam.tf`: 앱 역할에 S3(uploads/evidence/assets) + Secrets 읽기 + logs + VPC 정책.
- [ ] **Step 3** `terraform plan` → Lambda/IAM 신규 확인. `apply`.
- [ ] **Step 4: 검증** Function URL 직접 curl → SSR HTML 또는 리다이렉트(아직 CloudFront 전이라 정적 깨짐 정상). 200/3xx면 Lambda 구동 OK.
- [ ] **Step 5: Commit** `infra(subA): OpenNext server Lambda + IAM(S3/Secrets)`

---

## Phase 4 — CloudFront + OAC

### Task 4.1: CloudFront 배포
**Files:** `infra/cloudfront.tf`
- [ ] **Step 1** 작성:
  - `aws_cloudfront_origin_access_control`(S3 assets용, sigv4).
  - 오리진 2개: (a) Lambda Function URL(custom origin, https-only), (b) S3 assets(OAC).
  - 기본 비헤이비어 → Lambda(캐시 최소, all viewer 헤더/쿠키 중 Auth.js 쿠키·Host 전달, `Cache-Control` 존중).
  - 정렬 비헤이비어: `/_next/static/*`, `/_next/image`(image fn 쓰면), 정적 확장자 → S3 assets(장기 캐시) 또는 OpenNext 규칙대로.
  - `viewer_certificate { cloudfront_default_certificate = true }` (커스텀 도메인 X).
  - S3 assets 버킷 정책: 이 CloudFront distribution OAC만 `s3:GetObject` 허용.
  - Function URL 접근 제한: OAC for Lambda(지원 시) 또는 커스텀 헤더 시크릿으로 CloudFront만 통과.
- [ ] **Step 2** `terraform plan` → CloudFront/OAC/정책 신규. `apply`(배포 전파 수 분).
- [ ] **Step 3** assets 업로드: `aws s3 sync .open-next/assets s3://pokeca-assets-138681986450/_next/... ` (OpenNext output 경로 규칙대로; deploy.sh로).
- [ ] **Step 4: 검증** `curl https://<dist>.cloudfront.net/` → **정적+SSR 정상**(홈 렌더), `/_next/static/...` 200, 캐시 헤더 확인.
- [ ] **Step 5: Commit** `infra(subA): CloudFront + OAC(assets/Lambda), 기본 도메인`

---

## Phase 5 — 시크릿/ENV 주입

### Task 5.1: 앱 시크릿
**Files:** `infra/secrets.tf`, `infra/app.tf`(env 연결)
- [ ] **Step 1** `AUTH_SECRET`(랜덤), `AUTH_KAKAO_ID/SECRET`, `AUTH_GOOGLE_ID/SECRET`를 Secrets Manager(또는 Lambda env). `DATABASE_URL`은 기존 db 시크릿 조합. `S3_BUCKET_*`, `AWS_REGION`.
- [ ] **Step 2** 앱 Lambda가 시작 시 시크릿 로드(env 직접 주입 또는 entrypoint fetch). OpenNext는 env 직접 주입이 단순 → Lambda `environment.variables`로.
- [ ] **Step 3** `terraform apply`.
- [ ] **Step 4: 검증** `/api/auth/session` 200(세션 없음 JSON), 어드민 로그인 폼 로드. DB 접근하는 페이지(카드 검색) 정상.
- [ ] **Step 5: Commit** `infra(subA): 앱 시크릿/ENV 주입`

---

## Phase 6 — OAuth 프로드 등록 + end-to-end 스모크

### Task 6.1: 카카오·구글 콘솔에 cloudfront.net 리다이렉트 등록 (사용자+ego)
- [ ] **Step 1** 배포 도메인 확정(`terraform output cloudfront_domain`).
- [ ] **Step 2** ego-lite로 카카오/구글 콘솔에 `https://<dist>.cloudfront.net/api/auth/callback/{kakao,google}` + JS origin 추가(기존 localhost 유지).
- [ ] **Step 3** `AUTH_URL`/`trustHost` 등 Auth.js 호스트 설정이 cloudfront 도메인을 신뢰하는지 확인(env `AUTH_URL=https://<dist>.cloudfront.net` 또는 `AUTH_TRUST_HOST=true`).

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

## 리스크
- NAT 인스턴스 iptables vs fck-nat: 구현 시 택1(fck-nat 권장).
- Function URL을 CloudFront로만 제한하는 방식(Lambda OAC 지원 여부) — 미지원 시 커스텀 헤더 시크릿.
- Auth.js `trustHost`/`AUTH_URL`이 cloudfront 도메인과 맞아야 콜백 정상(Task 6.1에서 핀).
- CloudFront가 Auth.js 세션 쿠키·Host 헤더를 Lambda로 정확히 전달해야 함(비헤이비어 쿠키/헤더 정책).
