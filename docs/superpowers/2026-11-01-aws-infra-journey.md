# AWS 인프라 Phase 1 — 결정사항 & 이슈 기록

- 기간: 2026-10-31 ~ 2026-11-01
- 범위: art-poke(pokeca)를 Vercel+Supabase → AWS 네이티브로 이전 (Phase 1 = 인프라 골대)
- 결과: ✅ **`DB OK` 달성** (컴퓨팅 → VPC → RDS 연결 증명). 25개 리소스 live(도쿄).
- 관련 문서: 설계 `specs/2026-10-31-aws-infra-phase1-design.md`, 플랜 `plans/2026-10-31-aws-infra-phase1.md`

---

## 1. 내린 결정 (결정 로그)

| # | 결정 | 선택 | 이유 / 대안 |
|---|---|---|---|
| D1 | 이전 목적 | **실제 AWS 네이티브 이전** | IaC만/하이브리드/학습용 중 "실이전" 선택 |
| D2 | Supabase 처리 | **완전 AWS 네이티브** (제거) | RDS+Cognito로 대체. 데이터 거의 없는 지금이 적기 |
| D3 | IaC 도구 | **Terraform** | CDK보다 AWS를 눈에 보이게 배움 + 이직가치 1위. 멀티클라우드 중립 |
| D4 | 권한(인증/인가) | **Cognito + 앱 레이어 권한** (RLS 안 씀) | 현재 앱이 이미 `lib/admin.ts` if문으로 인가 처리, RLS 정책 0개(장식). "누구야?"만 Cognito로 교체 |
| D5 | DB | **RDS Postgres t4g.micro** | 프리티어. Aurora Serverless v2는 초소형엔 과함 |
| D6 | 레포 배치 | **같은 레포 `pokeca/infra/`** | 앱과 버전·PR 동기화. 소규모 이상적 |
| D7 | CloudFront | **v1 제외** | 한국 사용자+가까운 리전이라 체감 이득 작음. 나중 무중단 추가 |
| D8 | 시크릿 | **Secrets Manager** | `.env` 대체 |
| D9 | 메일 | **Resend 유지** | SES 전환은 YAGNI |
| D10 | 리전 | **도쿄(ap-northeast-1)** ← 서울에서 변경 | **App Runner가 서울 미지원**(I3 참고). 한국↔도쿄 ~30ms |
| D11 | 컴퓨팅(최초) | App Runner | ALB 불필요·운영 단순·콜드스타트 없음. 초보 적합 (→ I4로 폐기) |
| D12 | 컴퓨팅(최종) | **Lambda(서버리스)** ← App Runner에서 변경 | App Runner 단종(I4). ALB 불필요, 유휴 0 수렴(월 ~1만원↓), 멀티 사이드프로젝트 추가 거의 공짜. 대가=콜드스타트 1~3초(5분 핑으로 완화) |
| D13 | MCP 역할 | **aws-api = 조회·검증 전용** | 정본은 Terraform 코드. "만드는 건 코드, 보는 건 MCP" |
| D14 | 계정 분리 | **`artpoke` 전용 프로파일** | 회사 계정(`gr-readonly`, green-ribbon)과 철저 격리. 모든 호출 `--profile artpoke` + 쓰기 전 계정ID(138681986450) 검증 |
| D15 | 상태 백엔드 | **S3(서울) + 네이티브 잠금** | Terraform 1.10+ `use_lockfile`, DynamoDB 불필요. 상태버킷 리전(서울)은 리소스 리전(도쿄)과 별개 |
| D16 | IAM 운영자 | **전용 IAM 유저 + 액세스 키** (루트 아님) | 루트 키는 범위제한 불가·전권이라 금지. AdministratorAccess 단일 정책 |

### 멀티프로젝트 방침 (나중)
- 성격 다른 사이드프로젝트는 **VPC + RDS 인스턴스 공유**(한 인스턴스에 DB 여러 개), **컴퓨팅만 프로젝트별**.
- Lambda면 2번째 프로젝트 추가 비용 거의 0(각자 Function URL 무료, 유휴 0). Fargate면 앱당 상시비.
- 지금은 단일 프로젝트로 두고, 실제 2번째 생길 때 platform(VPC+RDS) / app(컴퓨팅) 레이어 분리로 리팩터.

---

## 2. 겪은 이슈 (이슈 로그)

| # | 이슈 | 원인 | 해결 |
|---|---|---|---|
| I1 | 로컬 AWS 자격증명 무효(`InvalidClientTokenId`) | `default` 프로파일 만료/모호, `gr-readonly`는 회사 | `artpoke` 전용 프로파일 신설, 계정ID 검증 후 진행 |
| I2 | `aws configure`가 `!` 모드에서 `EOF` | Claude 셸의 비대화형(TTY 없음) | 사용자 실제 터미널 앱에서 대화형 실행 |
| I3 | **App Runner가 서울(ap-northeast-2)에 없음** | 리전 미지원 (DNS `no such host`) | 전 리소스 **도쿄(ap-northeast-1)**로 이전(destroy→recreate, 빈 리소스라 저렴) |
| I4 | **App Runner 서비스 생성 불가** (`Account can't create new App Runner services`) | **App Runner가 2026-04-30부터 신규 고객 단종**(콘솔 공지 확인). 지원케이스/대기 무의미 | 컴퓨팅을 **Lambda로 전환** (ECS Express Mode는 Terraform 지원 불확실해 배제) |
| I5 | Terraform state 저장 실패 → AWS엔 리소스 있는데 state 비어 orphan | 네트워크 블립으로 state 쓰기/락 실패(S3 `.tflock` GetObject 실패) | 스턱 락 제거 + orphan 리소스 CLI로 전부 삭제 후 깨끗한 재apply |
| I6 | docker `login` 무한 멈춤 | macOS `credsStore: desktop`가 비대화형에서 keychain 접근 못 함 | `DOCKER_CONFIG`를 임시 디렉터리로 지정(keychain 우회) |
| I7 | ECR 푸시 실패 — 태그가 `pokeca-appatest`로 깨짐 | **zsh가 `"$ECR_URL:latest"`의 `:l`을 소문자 모디파이어로 해석** | `"${ECR_URL}:latest"` (중괄호) |
| I8 | SG 삭제 실패 — ENI 분리 `AuthFailure` | rds SG의 **description 변경이 SG 전체 교체 유발**, RDS에 ENI 붙어 교체 실패 | description은 원래 값 유지, ingress 참조만 in-place 변경 |
| I9 | `Cycle` 에러 | 교체 회피용 `create_before_destroy`가 RDS↔SG↔Lambda 사이클 유발 | create_before_destroy 제거, description 미변경으로 교체 자체를 없앰 |
| I10 | 옛 compute SG 삭제 막힘 (`DependencyViolation`) | **rds SG가 옛 SG를 ingress로 참조**(ENI 아님, SG간 참조). + 커넥터 hyperplane ENI 잔재 | `terraform state rm`으로 옛 SG를 관리 제외 → apply로 rds SG를 새 SG 참조로 업데이트 → 참조 끊긴 옛 SG CLI 삭제 |
| I11 | Lambda Function URL `403 Forbidden` (권한 추가 후에도) | ① Terraform은 `aws_lambda_permission`(InvokeFunctionUrl, principal *) 수동 필요(콘솔은 자동) ② **그래도 신규 계정 레벨 제한**으로 공개 URL 차단(조직 아님, 정책 올바름) | 권한 리소스 추가함. 공개 URL은 **미해결(Phase 2)** — 연결 증명은 `aws lambda invoke`로 대체(DB OK 확인) |

---

## 3. 최종 아키텍처 (Phase 1)

```
(검증) aws lambda invoke ──▶ Lambda(healthcheck, VPC)
                                   │ VPC ENI (lambda SG)
                                   ▼
                              RDS Postgres (사설 서브넷, rds SG ← lambda SG 5432)
       Cognito(빈 풀) · S3(비공개) · ECR(Phase2용) · Secrets Manager
       리전: 도쿄(ap-northeast-1) / 상태버킷: 서울(ap-northeast-2)
       Function URL: 생성됨, 공개 접근은 신규계정 제한으로 403(Phase 2)
```

- 컴퓨팅: Lambda(Node 20, VPC 연결). DB 자격증명은 env 주입(VPC Lambda는 NAT 없어 Secrets 런타임조회 불가).
- `terraform plan = No changes` (코드 = 실제 일치).

---

## 4. 비용

프리티어 기준 **월 ~1~3천원대** (Lambda 유휴 0 수렴 + RDS 프리티어). 프리티어 조건: 신규 계정·단일 AZ·gp2·≤20GB. 안 쓸 땐 `terraform destroy`로 0원.

---

## 5. 남은 일 (Phase 2)

- [ ] 공개 입구 해결: API Gateway/CloudFront로 Lambda 감싸기 or 계정 공개URL 제한 해제
- [ ] Cognito 인증 교체 + 자체 `users` 테이블(FK `auth.users` → Cognito sub)
- [ ] Supabase `migrations/` → RDS 이식
- [ ] S3 업로드 경로 전환(현 Supabase Storage)
- [ ] 진짜 Next.js 서버리스 배포(OpenNext 등) + RDS 커넥션 대책(RDS Proxy 검토)
- [ ] VPC 엔드포인트 추가(Secrets Manager 런타임 조회 승격)
- [ ] 플랜 문서를 App Runner 기준 → Lambda 기준으로 갱신
- [ ] 콜드스타트 완화: 5분 keep-warm 핑(EventBridge)
- [ ] (정리) `infra/healthcheck/`(App Runner 컨테이너 잔재) 제거 여부 결정

---

## 6. 핵심 교훈

1. **새 서비스 쓰기 전 리전 가용성 + 수명주기(단종 여부) 확인.** App Runner는 서울 미지원 + 신규고객 단종이었음. 설계 시점엔 몰랐던 사실이 실배포에서 두 번 벽이 됨.
2. **RDS에 붙은 SG는 교체가 비싸다.** description(불변) 건들지 말고 ingress만 바꿔라. SG간 참조는 ENI처럼 안 보여도 삭제를 막는다.
3. **state는 성스럽다.** 네트워크 블립으로 state 저장 실패 시 AWS와 state가 어긋나 orphan 발생. 락/orphan 정리 후 재apply.
4. **VPC Lambda는 격리됨** — 인터넷/AWS API 못 나감(NAT 없으면). 시크릿은 env 주입 or VPC 엔드포인트.
5. **콘솔 UX의 자동 처리(공개 권한 등)를 Terraform은 명시해야 한다.**
