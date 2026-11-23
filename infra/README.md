# pokeca 인프라 (Phase 1 — 인프라 골대)

art-poke를 AWS 네이티브로 올리는 **1단계**. Terraform으로 AWS 리소스를 세우고,
헬스체크 **Lambda**가 RDS에 붙어 **"DB OK"**를 응답하면
"Lambda → VPC → RDS" 배선이 증명된 것. (앱 코드 이전은 Phase 2)

- 설계: `../docs/superpowers/specs/2026-10-31-aws-infra-phase1-design.md`
- 플랜: `../docs/superpowers/plans/2026-10-31-aws-infra-phase1.md`

## 구성 리소스

VPC(사설 서브넷 2) · RDS Postgres t4g.micro · Cognito User Pool · S3(비공개) ·
ECR(Phase 2 앱 이미지용) · Secrets Manager · **Lambda(VPC 연결) + Function URL**

CloudFront 없음(소규모라 생략, 나중 무중단 추가). 메일은 Resend 외부 유지.

> ⚠️ **컴퓨팅 = Lambda(서버리스).** 원래 App Runner로 설계했으나 **App Runner가 2026-04-30부터 신규 고객을 안 받아서**(콘솔에서 확인) Lambda로 전환. ALB 불필요(Lambda가 입구·분배 내장), 유휴 시 비용 0 수렴. 대가는 콜드스타트 1~3초.
>
> ⚠️ **리전 = 도쿄(ap-northeast-1).** App Runner 검토 때 서울 미지원이라 도쿄로 통일했고 Lambda도 그대로 도쿄. 한국↔도쿄 지연 ~30ms. **Terraform 상태 버킷만 서울(ap-northeast-2)** (백엔드 리전은 리소스 리전과 별개).

## 선결 조건 (1회)

- AWS 계정 (RDS/Cognito 프리티어는 **신규 계정 12개월 내**)
- `aws configure --profile artpoke` 후 아래가 **개인 계정** 출력해야 함(회사 계정과 분리):
  ```bash
  aws sts get-caller-identity --profile artpoke   # Account=138681986450
  ```
- Terraform >= 1.10, Node 20, AWS CLI v2

## 실행 순서

### GitHub Actions 운영 배포 (초기 설정 1회)

`art-poke/pokeca`의 `main`에 푸시하면 [Deploy production](../.github/workflows/deploy-production.yml)이 DB 마이그레이션을 적용한 뒤 `scripts/deploy.sh`로 앱을 배포한다. Actions 탭에서 `main`을 선택해 수동 재실행할 수도 있다.

1. AWS 계정 `138681986450`의 IAM에 GitHub OIDC 공급자(`https://token.actions.githubusercontent.com`, 대상 `sts.amazonaws.com`)가 없으면 추가한다.
2. 그 공급자를 신뢰하는 전용 배포 역할을 만든다. 신뢰 정책은 아래처럼 저장소와 `main` 브랜치로 제한한다. 역할에는 [앱 배포 권한 정책](github-app-deploy-policy.json)을 인라인 정책으로 추가한다.

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": {
         "Federated": "arn:aws:iam::138681986450:oidc-provider/token.actions.githubusercontent.com"
       },
       "Action": "sts:AssumeRoleWithWebIdentity",
       "Condition": {
         "StringEquals": {
           "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
           "token.actions.githubusercontent.com:sub": "repo:art-poke@350312211/pokeca@1439814225:ref:refs/heads/main"
         }
       }
     }]
   }
   ```

3. GitHub 저장소 **Settings → Secrets and variables → Actions**에서 변수 `AWS_DEPLOY_ROLE_ARN` 및 `CLOUDFRONT_DISTRIBUTION_ID`를 등록한다.
4. 첫 실행에서 **Apply production database migrations**, **Deploy**, **Check production** 성공 여부를 확인한다. 앱 배포는 현재 Lambda 환경 설정을 사용한다.

### 0. 상태 버킷 부트스트랩 (1회)

```bash
aws s3api create-bucket --bucket pokeca-tfstate-138681986450 \
  --region ap-northeast-2 --create-bucket-configuration LocationConstraint=ap-northeast-2 --profile artpoke
aws s3api put-bucket-versioning --bucket pokeca-tfstate-138681986450 \
  --versioning-configuration Status=Enabled --profile artpoke
```
(`backend.tf`에 이 버킷명이 이미 들어 있음)

### 1. Lambda 패키지 빌드 (pg 설치)

```bash
cd lambda-healthcheck && npm install --omit=dev && cd ..
```

### 2. init + apply (단일 apply — ECR 닭달걀 없음)

```bash
export AWS_PROFILE=artpoke
terraform init
terraform plan      # VPC·RDS·Cognito·S3·ECR·Secrets·IAM·Lambda·FunctionURL
terraform apply     # RDS 생성 ~5분, Lambda VPC ENI ~1분
```

### 3. 검증 — DB OK

```bash
# 핵심: Lambda → VPC → RDS 연결 증명 (직접 호출)
aws lambda invoke --function-name pokeca-healthcheck \
  --cli-binary-format raw-in-base64-out /tmp/out.json --profile artpoke --region ap-northeast-1
cat /tmp/out.json      # {"statusCode":200,...,"body":"DB OK"}
```

> ⚠️ **공개 Function URL은 신규 계정에서 403 Forbidden**일 수 있음(이 계정 현재 그러함). 리소스 정책(AuthType NONE + 공개 InvokeFunctionUrl)은 올바른데도 계정 레벨 제한으로 막힘 — App Runner 신규계정 게이트와 같은 패턴. Phase 2에서 API Gateway/CloudFront로 감싸거나 계정 제한 해제로 해결. **연결 증명 자체는 위 직접 호출로 충분.**

## 비용 (월, 대략)

RDS 프리티어 $0(이후 ~$12) + Lambda ~$0(유휴 0 수렴) + Cognito/S3/Secrets ~$1–3
→ **~$1–3** (프리티어 기준). 프리티어 조건: 신규 계정·단일 AZ·gp2·≤20GB.

## 정리 (비용 폭주 방지)

```bash
terraform destroy   # 전체 삭제. 다시 쓰려면 위 1~3 재실행.
```

## 함정 메모 (이번에 겪음)

- **App Runner 단종(신규고객)** → Lambda로 전환. 서울 미지원이라 도쿄 사용.
- **SG description은 수정 불가** → 바꾸면 SG 전체 교체 유발, RDS에 ENI 붙어 있으면 교체 실패/사이클. rds SG description은 원래 값 유지하고 ingress만 교체.
- **SG 간 참조**(rds SG가 compute SG를 ingress로 참조)는 ENI처럼 안 보이지만 compute SG 삭제를 막음(DependencyViolation).
- **VPC Lambda는 인터넷/AWS API 접근 불가**(NAT 없음) → Secrets Manager 런타임 조회 불가. Phase 1은 DB 자격증명을 Lambda env로 주입. Phase 2는 VPC 엔드포인트 추가 권장.
- **Function URL 공개(AuthType NONE)**라도 Terraform은 `aws_lambda_permission`(InvokeFunctionUrl, principal \*)을 수동 추가해야 함(콘솔은 자동).
- **ECR docker push (Phase 2)**: macOS `credsStore: desktop`이 비대화형에서 멈춤 → `DOCKER_CONFIG` 임시 디렉터리 우회. zsh는 `"${ECR_URL}:latest"`(중괄호) — `"$ECR_URL:latest"`는 `:l` 모디파이어로 태그 깨짐.

> 참고: `healthcheck/`(컨테이너 버전)는 App Runner 시절 잔재. 현재 Lambda는 `lambda-healthcheck/` 사용. Phase 2 앱 컨테이너화 때 ECR+`healthcheck/` 패턴 참고 가능.

## 스키마 변경 절차 (2026-11-05부터)

`infra/db/00_authjs.sql`·`01_app.sql`은 **기준선**(처음 만들 때 한 번)이고 더 이상 끝에 덧붙이지 않는다. 변경은 `infra/db/migrations/<YYYYMMDD_HHMMSS>_<이름>.sql` 파일로 추가한다.
migrate Lambda(`lambda-migrate/migrate.mjs`)는 `public.schema_migrations`에 실행한 파일명을 기록하고, 기록 없는 파일만 파일명 순서로 실행한다(파일 하나 = 트랜잭션 하나). 테이블이 이미 있는 DB에서 처음 돌리면 기준선은 실행 없이 기록만 남긴다.

`main` 운영 배포는 `scripts/deploy-migrations.sh`를 먼저 실행한다. 이 스크립트가 체크아웃의 `infra/db`로 마이그레이션 Lambda를 갱신하고 호출한다. DB 적용이나 Lambda 호출이 실패하면 GitHub Actions는 앱 배포를 중단한다. 기존 배포 역할에는 [갱신된 IAM 권한](github-app-deploy-policy.json)을 한 번 적용해야 한다. SQL로 포함된 시드는 자동 적용된다. 퀴즈 문제 은행은 발행된 로컬 DB에서 `scripts/export-card-fragment-bank.mts`로 새 `.sql.gz` 시드 마이그레이션을 만들면 카드 조각용 이미지와 함께 자동 배포된다. 새 은행마다 사용하지 않은 날짜 범위를 지정한다. 카드 검색용 외부 이미지는 별도의 업로드 절차를 사용한다.

```bash
npm run db:migrate                                   # 로컬(DATABASE_URL)에 같은 로직 적용
# 데이터(카드 시드 등)도 같은 경로로 넣는다. RDS는 외부 접속이 없으므로 스크립트로 직접 쓰지 않는다:
#   npm run cards:seed-sql -- --out db/migrations/<YYYYMMDD_HHMMSS>_cards_seed.sql   (CSV+이미지 manifest → SQL)
rm -rf lambda-migrate/sql && cp -R db/. lambda-migrate/sql/ && (cd lambda-migrate && npm install --omit=dev)
AWS_PROFILE=artpoke terraform apply -target=aws_lambda_function.migrate
aws lambda invoke --function-name pokeca-migrate --profile artpoke --region ap-northeast-1 /dev/stdout
# → {"applied":[...새로 실행한 파일...],"recorded":[...],"skipped":[...],"tables":N}
```
