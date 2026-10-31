# art-poke AWS 인프라 이전 — 설계 (Phase 1: 인프라 골대)

- 작성일: 2026-10-31
- 대상 앱: `pokeca` (Next.js App Router, 현재 Vercel + Supabase)
- 작성자: 이윤재 (프론트엔드 개발자, AWS 거의 처음)
- 범위: **Phase 1 — Terraform으로 AWS 리소스 골대 세우기 + 빈 통 배포 검증**

---

## 1. 목표와 배경

art-poke(`pokeca`)를 **Vercel + Supabase → 완전 AWS 네이티브**로 이전한다.
인프라는 앱과 같은 레포 `pokeca/infra/`에 **Terraform 코드로 정본화**한다.

- **IaC 정본 = Terraform 코드.** 사람이 콘솔에서 손으로 만들지 않는다.
- **MCP(aws-api) = 조회·검증 전용.** 만들지 않고 들여다본다.
- 앱 생성 시점: 2026-10-30. 데이터·트래픽이 거의 없어 **지금이 이전 적기**다.

### 이전 전체 공사량 (참고, 솔직한 순위)

1. 🔴 Cognito 인증 교체 + 자체 `users` 테이블 신설 (앱 코드 수정) — Phase 2
2. 🟡 Next.js 컨테이너화(Dockerfile) + App Runner 실배포 — Phase 2
3. 🟡 S3 업로드 경로 교체 (현 Supabase Storage 사용부) — Phase 2
4. 🟢 RDS로 마이그레이션 SQL 이식 (`auth.users` FK만 수정) — Phase 2
5. 🟢 Terraform 인프라 정의 — **Phase 1 (이번)**

---

## 2. 확정된 기술 결정

| 영역 | 결정 | 이유 |
|---|---|---|
| IaC 도구 | **Terraform** | AWS를 눈에 보이게 배움, 시장가치 1위, 클라우드 중립. 초보 예제 풍부 |
| 컴퓨팅 | **App Runner** (Next.js 컨테이너) | 입구·HTTPS·오토스케일·헬스체크 내장 → ALB 불필요, Fargate보다 운영 단순·저비용 |
| DB | **RDS Postgres t4g.micro** | 프리티어(첫 1년 무료). Aurora Serverless v2는 초소형엔 과함 |
| 인증 | **Cognito** | Supabase Auth 교체. 빈 풀은 ~$0 (MAU 과금 티어는 Phase 2 전 재확인) |
| 권한 | **앱 레이어 권한 (현 구조 유지)** | 현재 앱이 이미 `lib/admin.ts` 등에서 if문으로 권한 체크. RLS는 정책 0개(장식) |
| RLS | **안 씀 (현 상태 유지)** | 현재 `enable row level security`만 켜고 `create policy` 0개. 새로 짜는 건 YAGNI |
| 스토리지 | **S3** (버킷만, Phase 1) | 업로드 저장. CloudFront는 v1 제외 |
| CDN | **CloudFront 제외 (v1)** | 한국 사용자 + 서울 리전이라 S3 직접도 충분히 빠름. 해외/트래픽 증가 시 무중단 추가 |
| 시크릿 | **Secrets Manager** | `.env` 대체. DB 비번·키 보관 |
| 메일 | **Resend 유지** | SES 전환은 YAGNI |
| 리전 | **ap-northeast-2 (서울)** | 사용자 위치 |
| MCP | **aws-api = 조회·검증 전용** | 정본은 Terraform. (aws-api MCP는 지원 종료 예정 → 추후 AWS MCP Server 이전) |

### 인증 vs 권한 개념 정리 (이전 판단 근거)

- **Cognito = 인증(Authentication)** = "너 누구야?" — 로그인·세션. 어느 경우든 **필요**.
- **RLS = 권한(Authorization)** = "이 행(row) 봐도 돼?" — Postgres가 DB 레벨에서 행별로 거름. **선택**.
- 현재 앱의 실제 흐름:
  - 데이터 접근은 전부 `lib/supabase/server.ts`의 `db()` = **secret 키(RLS 우회)**로 서버 코드에서 수행.
  - 권한 판단은 `lib/admin.ts` 등에서 **앱 코드 if문**(`admins` 허용목록 조회)으로 수행.
  - RLS는 켜져 있으나 정책 0개 = "기본 거부" 안전장치일 뿐, 실제 권한 로직 아님.
- 따라서 이전 시: **"누구야?"만 Cognito로 교체**, 권한 if문은 재사용. RLS는 건드리지 않음.
- 주의: 현재 FK가 `auth.users(id)`(Supabase 전용 스키마)를 참조 → RDS엔 없음 → **자체 `users` 테이블** 신설 후 Cognito `sub` 저장하도록 수정 필요 (Phase 2).

---

## 2.5 전제조건 & 상태 백엔드 부트스트랩 (실행 전 필수)

Terraform을 돌리기 전에 아래가 먼저 되어 있어야 한다. 초보자가 제일 먼저 막히는 지점들.

### 전제조건 (사람이 1회 준비)

- AWS 계정 (RDS/Cognito 프리티어는 **신규 계정 가입 후 12개월** 내에서만 유효)
- IAM 관리자 사용자 또는 IAM Identity Center(SSO)
- 로컬에 AWS CLI 설치 + `aws configure`(또는 SSO 프로파일) 설정
- 확인: `aws sts get-caller-identity`가 내 계정을 출력하면 OK
- **Terraform >= 1.10** (S3 네이티브 잠금을 쓰려면 필수. `backend.tf`의 "DynamoDB 불필요"가 이 버전에 의존)

### 상태 백엔드 부트스트랩 (닭-달걀 문제 해결)

`backend.tf`가 상태파일을 S3에 저장하는데, **그 S3 버킷 자체는 Terraform이 자기 자신을 못 만든다.** 그래서 **1회만** 수동 생성한다:

```
# 1회 부트스트랩 (버전관리 켠 상태 버킷 생성)
aws s3api create-bucket --bucket pokeca-tfstate-<고유suffix> \
  --region ap-northeast-2 \
  --create-bucket-configuration LocationConstraint=ap-northeast-2
aws s3api put-bucket-versioning --bucket pokeca-tfstate-<고유suffix> \
  --versioning-configuration Status=Enabled
```

그 다음 `backend.tf`에 이 버킷명을 적고 `terraform init`. (DynamoDB 잠금 테이블은 Terraform 1.10+ S3 네이티브 잠금을 쓰므로 만들지 않는다.)

이 절차는 `infra/README.md` 최상단에 그대로 적는다.

## 3. 아키텍처 (Phase 1 완료 시점)

```
                    인터넷
                      │
              ┌───────▼────────┐
              │  App Runner    │  ← 빈 헬스체크 컨테이너 (Phase 1)
              │  (TLS·오토스케일 │     → Phase 2에서 진짜 Next.js로 교체
              │   내장)         │
              └───┬────────┬───┘
                  │(VPC Connector)
         ┌────────┘        └──────────┐
         │                            │
  ┌──────▼──────┐          ┌──────────▼──────┐
  │  Cognito    │          │  RDS Postgres    │ ← 빈 상태 (Phase 1)
  │ (빈 User Pool)│          │  t4g.micro       │
  └─────────────┘          │  사설 서브넷       │
                           └──────────────────┘
  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
  │ S3 (빈 버킷) │  │ Secrets Mgr   │  │ ECR          │
  │             │  │ (DB 자격증명)  │  │ (이미지 저장) │
  └─────────────┘  └──────┬───────┘  └──────▲───────┘
                          │ RuntimeEnvSecrets│ 이미지 pull
                          │ (Instance Role)  │ (Access Role)
                   App Runner가 참조 ────────┘

  Resend(메일) → 외부 유지 (변경 없음)
  CloudFront → v1 제외 (나중 무중단 추가)
```

### 사용자 요청 플로우 (Phase 2 실앱 기준, 참고)

- **동적 페이지/API(SSR·서버액션):** 사용자 → App Runner → RDS/Cognito (CF 불필요)
- **Next 정적 자산(/_next/static):** App Runner가 직접 제공 (CF는 선택)
- **업로드 이미지:** 사용자 → S3 직접 (CF는 v1 제외, 나중에 S3 앞에 얹음)

---

## 4. Phase 1 범위 — 만드는 것

빈 껍데기 인프라. 앱 로직 없음. "배선이 통한다"만 증명.

| 리소스 | 역할 | Phase 1 상태 |
|---|---|---|
| VPC (최소) | App Runner ↔ RDS 사설 연결 | 서브넷·보안그룹 포함 |
| RDS Postgres t4g.micro | DB | 빈 DB, 사설 서브넷 |
| Cognito User Pool + App Client | 로그인 기반 | 빈 풀만 생성 |
| S3 버킷 | 업로드 저장소 | 빈 버킷 |
| Secrets Manager | DB 비번·키 | Terraform이 자동 생성·주입 |
| ECR | 컨테이너 이미지 저장소 | App Runner가 당겨감 |
| App Runner + VPC Connector | 앱 실행 | **빈 헬스체크 컨테이너** 배포 |
| App Runner **Access Role** (IAM) | ECR에서 이미지 당기기 | 비공개 ECR 필수 |
| App Runner **Instance Role** (IAM) | 실행 중 Secrets Manager 읽기 | DB 자격증명 접근 |

### App Runner 세부 설정 (초보자 함정 방지)

- **헬스체크: HTTP + 경로 지정.** App Runner 기본값은 TCP라, TCP로만 두면 앱이 실제로 깨졌어도 "정상"으로 뜰 수 있다. `apprunner.tf`에서 health check를 **HTTP `/health`**로 설정하고, healthcheck 컨테이너에 그 라우트를 만든다.
- **DB 자격증명 주입:** App Runner의 `RuntimeEnvironmentSecrets`가 Secrets Manager 시크릿 ARN을 참조해 컨테이너 환경변수로 주입한다. `server.js`는 그 환경변수로 RDS에 접속해 "DB OK"를 판정한다. (컨테이너가 SDK로 직접 당기지 않음 — App Runner가 주입)

### `pokeca/infra/` 디렉터리 구조

```
infra/
├── README.md              # 초보자용 "이 명령어만 치면 됨" 가이드
├── providers.tf           # AWS provider, 서울 리전
├── backend.tf             # 상태파일 S3 저장 (S3 네이티브 잠금, DynamoDB 불필요)
├── variables.tf           # 프로젝트명·리전 등 입력값
├── vpc.tf                 # VPC + 서브넷 + 보안그룹
├── rds.tf                 # Postgres
├── cognito.tf             # User Pool + App Client
├── s3.tf                  # 업로드 버킷
├── ecr.tf                 # 이미지 저장소
├── apprunner.tf           # App Runner + VPC Connector + 헬스체크(HTTP /health) + RuntimeEnvironmentSecrets
├── iam.tf                 # App Runner Access Role(ECR) + Instance Role(Secrets)
├── secrets.tf             # Secrets Manager (DB 자격증명)
├── outputs.tf             # 생성 후 URL·엔드포인트 출력
└── healthcheck/           # 빈 통: RDS 연결 확인용 미니 컨테이너
    ├── Dockerfile
    └── server.js          # /health 라우트, 주입된 DB 자격증명으로 RDS 접속 → "DB OK"
```

> 참고: 상태 백엔드 버킷은 §2.5에서 1회 수동 생성하므로 Terraform 파일로 관리하지 않는다 (닭-달걀).

---

## 5. 배포 & 검증 플로우

```
0. (1회) 전제조건 확인 + 상태 버킷 부트스트랩  → §2.5
1. cd infra && terraform init     → S3 백엔드 연결
2. terraform plan                 → 생성될 리소스 미리보기 (안전 확인)
3. terraform apply                → AWS에 실제 생성
4. healthcheck 이미지 빌드 → ECR 푸시
5. App Runner 자동 배포 → 공개 URL 생성
6. URL 접속 → "DB OK" 응답 → 성공 ✅
   (= App Runner → VPC → RDS 전체 배선 증명)
7. MCP(aws-api)로 생성된 리소스 조회·검증
```

**핵심 검증 포인트:** 6번 "DB OK"가 뜨면 가장 어려운 부분(App Runner가 사설망 RDS에 닿기)이 끝. Phase 2에서 진짜 앱 얹기가 쉬워진다.

---

## 6. MCP(aws-api) 역할

*만들지 않는다. 들여다본다.*

- `terraform apply` 후 리소스 상태 조회 (RDS 상태, App Runner 배포 로그, Cognito 설정)
- 문제 디버깅 (App Runner가 RDS 못 닿을 때 보안그룹·VPC Connector 확인)
- ⚠️ aws-api MCP는 **지원 종료 예정** → 나중에 AWS MCP Server로 이전 권장 (Phase 1엔 무관)

---

## 7. 비용 (월, Phase 1)

| 항목 | 비용 | 메모 |
|---|---|---|
| RDS t4g.micro | $0 (첫 1년 프리티어) / 이후 ~$12 | **프리티어 조건: 신규 계정·단일 AZ·gp2·≤20GB.** Multi-AZ나 gp3·초과 스토리지면 과금됨 |
| App Runner | ~$0–5 | 유휴 최소, ALB 없음 |
| Cognito | ~$0 | 빈 풀은 ~$0. MAU 과금 티어는 Phase 2 전 재확인 |
| S3 + Secrets Manager | ~$1–3 | |
| **합계** | **~$5–15** (프리티어 기준) | CloudFront 없음 |

---

## 8. 리스크 (초보자 함정 TOP 3)

1. **App Runner ↔ RDS 연결** — VPC Connector·보안그룹 설정이 틀리면 안 닿음.
   → healthcheck 컨테이너로 먼저 잡는 이유.
2. **Terraform 상태파일** — 잘못 지우면 인프라 추적 불가.
   → S3 백엔드 + 버전관리로 방어. 로컬 상태파일 금지.
3. **IAM 권한** — 너무 넓으면 보안 위험, 좁으면 안 돌아감.
   → 최소권한 원칙으로 리소스별 역할 분리.

---

## 9. 범위 밖 (Phase 2+, 이번 아님)

- Cognito 인증 교체 + 자체 `users` 테이블 신설 (앱 코드 수정)
- RDS로 마이그레이션 SQL 이식 (`auth.users` FK 수정)
- S3 업로드 전환 (현 Supabase Storage 사용부)
- 진짜 Next.js 컨테이너화 + 실배포
- CloudFront 추가 (해외 사용자/이미지 트래픽 증가 시)
- Vercel·Supabase 해지

---

## 10. 성공 기준 (Phase 1 Definition of Done)

- [ ] 전제조건 확인 (`aws sts get-caller-identity` 성공, Terraform >= 1.10) + 상태 버킷 부트스트랩 완료
- [ ] `infra/` Terraform 코드가 `terraform plan`에서 에러 없이 전체 리소스 계획 출력
- [ ] `terraform apply`로 VPC·RDS·Cognito·S3·Secrets·ECR·IAM(2개 역할)·App Runner 전부 생성
- [ ] App Runner가 ECR 이미지 pull(Access Role) + Secrets 주입(Instance Role) 성공
- [ ] healthcheck 컨테이너가 App Runner 공개 URL `/health`에서 "DB OK" 응답 (App Runner→RDS 배선 증명)
- [ ] `outputs.tf`가 App Runner URL·RDS 엔드포인트·Cognito 풀 ID 출력
- [ ] MCP(aws-api)로 생성 리소스 교차 검증 완료
- [ ] `infra/README.md`에 초보자용 재현 가이드(명령어 순서) 작성
- [ ] `terraform destroy`로 전체 정리 가능함을 확인 (비용 폭주 방지)
