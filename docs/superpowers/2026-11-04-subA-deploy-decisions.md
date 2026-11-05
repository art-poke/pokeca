# 인프라 결정 로그 — 서브 A 배포 (ADR)

> 왜/어떻게 이 선택을 했는지 추적용. 대화에서 확정된 결정을 근거와 함께 남긴다.
> 최종 갱신: 2026-11-04. 연관: `specs/2026-11-04-aws-phase2-subA-deploy-design.md`, `2026-11-02-aws-phase2-journey.md`.

각 결정 형식: **결정 / 대안 / 왜 / 되돌리는 법**.

---

## ADR-A1. 컴퓨트: 서버리스(OpenNext + Lambda + CloudFront) 채택

- **결정**: Next.js 앱을 **OpenNext로 서버리스**(Lambda server fn + CloudFront + S3 assets)로 배포.
- **대안**:
  - B. 컨테이너 — ECS Fargate / **App Runner** + Next 공식 `standalone` 빌드(OpenNext 불필요, 상시 가동).
- **왜**:
  - art-poke는 **저트래픽 팬 아카이브** → 유휴 시 요금 0(scale-to-zero)이 매력. 컨테이너는 상시 월 ~$15~40 고정.
  - 인수인계 Phase 2 설계에서 이미 서버리스로 잠정 결정됨(일관성).
  - 트레이드오프 인지: 서버리스는 **콜드스타트 + OpenNext 복잡도 + VPC Lambda라 NAT 필요**. 컨테이너(App Runner)는 더 단순(공식 경로, NAT 불필요)하지만 유휴 비용.
  - 사용자가 두 길의 비용/복잡도 트레이드오프를 듣고 **A(서버리스) 선택**.
- **맥락 메모**: 회사(Green Ribbon/lifecatch) 인프라는 ECS Fargate 기반 → B가 더 익숙했을 수 있으나, 유휴비용 0을 우선해 A로 감.
- **되돌리는 법**: OpenNext 산출물 대신 Next `standalone`을 App Runner/ECS로. CloudFront·NAT·OpenNext 관련 .tf 제거. RDS/S3/VPC는 공용이라 유지. 전환 비용 중간.

## ADR-A2. 배포 도구: OpenNext CLI + Terraform (SST 아님)

- **결정**: `open-next build` 산출물을 **기존 Terraform(infra/)**이 Lambda/S3/CloudFront로 배선.
- **대안**: SST v3(OpenNext 내장, `sst deploy` 간편).
- **왜**:
  - 현재 모든 인프라가 **Terraform 상태** 하나로 관리됨. SST는 CloudFormation 기반 별도 IaC라 **상태 이원화**(두 체계 공존·드리프트 위험).
  - 세밀 제어(NAT 인스턴스, 기존 VPC/RDS/S3 재사용) 필요 → Terraform이 적합.
  - 사용자는 OpenNext 자체가 생소 → 도구 선택은 위임받음("오픈넥스트가 모임"). 추천대로 진행.
- **되돌리는 법**: SST 도입 시 app 리소스를 SST로 이관, Terraform에선 app 관련만 제거(VPC/RDS/S3는 data 참조). 비용 중간.

## ADR-A3. 도메인: cloudfront.net 기본 도메인 먼저, 커스텀은 나중

- **결정**: 1차 배포는 CloudFront 기본 `*.cloudfront.net`으로 라이브. 커스텀 도메인은 **도메인 등록 후** 별도 단계.
- **대안**: 처음부터 커스텀 도메인(ACM us-east-1 + DNS) 세팅.
- **왜**:
  - 사용자는 **보유 도메인이 없음**("도메인 하나 해야겠는데"). 도메인 취득이 배포를 막으면 안 됨.
  - cloudfront.net 기본 인증서로 **즉시 라이브** 가능 → 커스텀 도메인은 나중에 **재작업 없이** CloudFront alias + ACM만 추가.
  - OAuth 리다이렉트 URI는 1차에 cloudfront.net 주소로 등록, 커스텀 도메인 단계에서 추가 등록.
- **후속 액션(열림)**: 도메인 이름 미정. 후보 예: `artpoke.io/.com/.gg/.kr`. 등록은 Route 53(연 ~$12~15) 권장 → 사용 가능 여부/가격 확인 후 진행.
- **되돌리는 법**: 커스텀 도메인은 추가만 하면 됨(기본 도메인은 유지 가능). 되돌릴 일 없음.

## ADR-A4. NAT: NAT 인스턴스(t4g.nano), NAT Gateway 아님

- **결정**: 아웃바운드 인터넷(카카오·구글 토큰 교환)을 **NAT 인스턴스 t4g.nano**로.
- **대안**: NAT Gateway(관리형, 고가용).
- **왜**: NAT Gateway 월 ~4만원 vs NAT 인스턴스 월 ~3천원. 저트래픽이라 단일 인스턴스로 충분. 비용 우선(인수인계 확정 결정).
- **리스크**: 단일 인스턴스 SPOF. 저트래픽 허용. 압박/가용성 필요 시 이중화 또는 Gateway 전환.
- **되돌리는 법**: `aws_nat_gateway`로 교체, 라우트 타깃만 변경. 저비용.

## ADR-A5. 작품 이미지 서빙: 1차 presigned GET 유지, CloudFront+OAC는 플랜에서 판단

- **결정**: 작품/아바타 이미지는 당장 **presigned GET 유지**. CloudFront+OAC 이미지 CDN은 서브 A 플랜에서 범위/우선순위 판단(서브 D 이월 항목).
- **왜**: 앱 CloudFront부터 세우는 게 1차 목표. 이미지 CDN은 presigned로도 동작하므로 라이브를 막지 않음. 과도한 동시 변경 지양.
- **되돌리는 법**: 후속에서 uploads 버킷 OAC 비헤이비어 추가.

## ADR-A6. OpenNext 캐시: incrementalCache/queue/tagCache = "dummy"

- **결정**: `open-next.config.ts`에서 세 캐시를 **dummy**로 끈다.
- **왜**: art-poke는 `cacheComponents` off = 거의 전동적 렌더. ISR/`revalidatePath`/`revalidateTag` 미사용. OpenNext 기본값은 **런타임에 S3 cache 버킷·SQS(queue)·DynamoDB(tagCache)를 기대** → 안 끄면 불필요 인프라 + 런타임 에러. dummy로 끄면 cache 버킷·revalidation fn·dynamodb-provider 배포 생략.
- **전제/리스크**: 앱에 ISR/revalidate 사용처가 생기면 깨짐 → 플랜 Task 1.2 grep으로 가드.
- **되돌리는 법**: override 제거 + cache 버킷/revalidation fn/Dynamo seed 배포.
- 근거: [OpenNext architecture](https://opennext.js.org/aws/inner_workings/architecture)

## ADR-A7. Host 처리: CloudFront viewer-request Function으로 x-forwarded-host 주입

- **결정**: CloudFront에 viewer-request Function을 붙여 `x-forwarded-host = Host`를 세팅. `Host`는 origin(Lambda Function URL)으로 forward하지 않음.
- **왜**: Lambda가 받는 `Host`는 Lambda 서비스 호스트명이라 그대로 쓰면 **Auth.js가 콜백 URL·세션 쿠키 도메인을 틀린 호스트로 생성 → OAuth/세션 전멸**. OpenNext 서버는 `x-forwarded-host`를 읽어 host를 잡으므로 CloudFront가 이 헤더를 넣어야 함. Function URL에 Host를 직접 forward하면 SNI/호스트 불일치로 깨짐.
- **보강**: Lambda env `AUTH_TRUST_HOST=true`(host 신뢰) + 도메인 확정 후 `AUTH_URL` 2차 주입.
- **되돌리는 법**: 거의 영구(OpenNext 구조상 필수).
- 근거: [opennextjs-aws #753](https://github.com/opennextjs/opennextjs-aws/issues/753)

## ADR-A8. Function URL 보호: Lambda 오리진 OAC (커스텀 헤더 아님)

- **결정**: 앱 Lambda Function URL을 `AWS_IAM` + **CloudFront OAC(origin type=lambda, sigv4)**로 보호. CloudFront만 호출 가능.
- **왜**: 2026-10 CloudFront가 Lambda Function URL에 OAC 정식 지원. 과거 관행인 "커스텀 헤더 시크릿"보다 깔끔. (단 aws provider가 lambda OAC 지원하는 버전이어야 — 현재 5.100, 미지원 시 bump.)
- **되돌리는 법**: 커스텀 헤더 + Function URL auth NONE로 회귀(비권장).
- 근거: [AWS What's New 2026-10](https://aws.amazon.com/about-aws/whats-new/2026/10/cloudfront-lambda-web-functions-origin/)

## ADR-A9. 스트리밍: BUFFERED (빌드 정본이 비스트리밍) + 버전 4.1.15

- **결정**: Lambda Function URL = **BUFFERED**. OpenNext 버전 **4.1.15**(latest).
- **왜**: Phase 1 실제 빌드 산출물 `open-next.output.json`이 `default.streaming=false`·`imageOptimizer.streaming=false` → **비스트리밍 빌드**. 따라서 RESPONSE_STREAM 불필요, 4.1.x 스트리밍 wedge 버그(#1315)도 무관. (리뷰어 H2는 일반적 스트리밍 가정이었으나 빌드 정본이 비스트리밍이라 BUFFERED로 확정.)
- **Next 버전 제약**: OpenNext 4.1.15 peer가 `next >=16.4.5`인데 앱은 16.4.3이었음 → **Next 16.4.3→16.4.5 패치 범프**(ADR-A11). react 19.3 유지.
- **되돌리는 법**: 스트리밍 필요 시 OpenNext 설정에 streaming 활성 + Function URL RESPONSE_STREAM + wedge-fix 버전 확인.
- 근거: 빌드 출력 `open-next.output.json`, [opennextjs-aws #1315](https://github.com/opennextjs/opennextjs-aws/issues/1315)

## ADR-A11. Next.js 16.4.3 → 16.4.5 패치 범프 (OpenNext 호환)

- **결정**: `next`·`eslint-config-next`를 **16.4.5**로 범프.
- **왜**: `@opennextjs/aws@4.1.15` peer = `next >=16.4.5`. 16.4.3은 미지원. 패치 레벨 범프라 리스크 낮음(react 19.3 유지, typecheck 0 확인). 16.5는 canary뿐이라 제외.
- **되돌리는 법**: OpenNext를 16.4.3 지원하는 과거 버전으로(단 wedge 버그/구버전 리스크).

## ADR-A10. 시크릿 주입: Lambda env 직접(Secrets Manager 런타임 fetch 아님)

- **결정**: `DATABASE_URL`(RDS 조합)·`AUTH_SECRET`·OAuth 키·`AUTH_TRUST_HOST`를 **Lambda 생성 시 env 직접 주입**. (`AWS_REGION`은 Lambda 예약 env라 주입 금지.)
- **왜**: 콜드스타트·단순성. 기존 lambda.tf도 DB env 직접 주입 패턴. `lib/db`는 `DATABASE_URL`(connectionString) 읽음(확인됨), `random_password.db` special=false라 URL 인코딩 안전. IAM에서 `secretsmanager:GetSecretValue` 불필요해짐.
- **리스크**: 시크릿이 Lambda 구성에 평문 노출(콘솔). 민감도 낮아 수용, 필요 시 후속에 Secrets Manager+KMS.
- **되돌리는 법**: entrypoint에서 Secrets Manager fetch + 역할에 read 권한.

## ADR-A12. sharp를 server fn에 명시 설치 (OpenNext install 옵션)

- **결정**: `open-next.config.ts`의 `default.install`로 `sharp@0.35.5`(arch x64 / os linux / libc glibc)를 **server fn 번들에 설치**.
- **왜**: 앱이 `lib/preview.ts`에서 `import sharp`(업로드 썸네일 생성)로 직접 사용. OpenNext는 sharp를 external 처리(image fn에만 설치) → server fn엔 dangling 심볼릭만 남아 **런타임 모듈 로드 실패("Failed to load external module sharp")로 SSR 500**. Lambda x86_64라 x64/linux/glibc 바이너리 필요. 증상: 홈 등 SSR 전부 500(초기 배포 때 실제 발생, install 추가 후 200).
- **부수 발견**: `data.archive_file`은 OpenNext의 심볼릭 링크(dangling 포함)를 못 다룸 → `zip -ry`로 번들 압축 + Terraform은 pre-built zip 참조(`filebase64sha256`). deploy.sh가 빌드+zip 담당.
- **되돌리는 법**: lib/preview.ts의 sharp 사용을 image fn/별도 경로로 옮기면 server fn install 불필요.

## ADR-A13. 앱 Lambda 역할 분리 + env 직접 주입 구현

- **결정**: 앱 전용 `aws_iam_role.app`(VPC+logs+S3 uploads/evidence) — migrate/healthcheck 공용 역할과 분리. 시크릿은 `aws_lambda_function.app_server/image`의 `environment.variables`에 직접(ADR-A10). OAuth 키는 `variables.tf`(sensitive) + gitignore `secrets.auto.tfvars`(.env.local에서 생성). `AUTH_SECRET`은 `random_password`.
- **검증**: Function URL(AWS_IAM)을 Function-URL 이벤트로 직접 invoke → `/api/auth/session` 200(null), 홈 200(DB 렌더). VPC→RDS(DATABASE_URL) 정상.

## ADR-A14. CloudFront → Lambda OAC: 권한 2개 필요 (InvokeFunctionUrl + InvokeFunction)

- **증상**: CloudFront OAC(lambda, always, sigv4) + Function URL(AWS_IAM) + `lambda:InvokeFunctionUrl` 권한까지 다 맞췄는데도 **모든 Lambda 오리진이 403 Forbidden**(S3 OAC는 정상). 함수(x-forwarded-host)·origin request policy 제거해도 403 유지 → 인증 자체 거부.
- **근본 원인**: AWS 문서상 OAC+Lambda Function URL은 **권한 2개**가 필요 — `lambda:InvokeFunctionUrl` **AND `lambda:InvokeFunction`**(둘 다 principal cloudfront.amazonaws.com, source_arn=distribution). InvokeFunction 누락 시 sigv4 요청이 403.
- **해결**: `aws_lambda_permission.cf_server_invoke`/`cf_image_invoke`(action `lambda:InvokeFunction`) 추가 → 즉시 홈 200(DB 렌더)·`/api/auth/session` 200.
- **부수 확인**: 기본 cloudfront.net 도메인에선 OAC가 Host를 올바르게 sigv4 서명(커스텀 도메인 CNAME 케이스의 Host 불일치 문제와 무관). x-forwarded-host 함수·AllViewerExceptHostHeader는 원인 아님(격리로 확인).
- 근거: [AWS: Restrict access to Lambda function URL origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda.html)

---

## 상속된 확정 결정 (Phase 2 공통, 재논의 안 함 — 근거는 journey 문서)
- 리전 도쿄, 상태버킷만 서울. 프로파일 **artpoke**(138681986450). 회사 gr-readonly 금지.
- 인증 Auth.js(카카오·구글·어드민 Credentials), 유저 **RDS**(Cognito 안 씀).
- 인가 앱 레이어 if문. 스토리지 S3(+서브 A에서 CloudFront OAC). 커넥션 Lambda 동시성 상한.
- 전환 빅뱅 컷오버(서브 E) 후 Vercel·Supabase 해지.
