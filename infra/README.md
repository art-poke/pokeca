# pokeca 인프라 (Phase 1 — 인프라 골대)

art-poke를 AWS 네이티브로 올리는 **1단계**. Terraform으로 AWS 리소스를 세우고,
빈 헬스체크 컨테이너가 App Runner 공개 URL에서 **"DB OK"**를 응답하면
"App Runner → VPC → RDS" 배선이 증명된 것. (앱 코드 이전은 Phase 2)

- 설계: `../docs/superpowers/specs/2026-10-31-aws-infra-phase1-design.md`
- 플랜: `../docs/superpowers/plans/2026-10-31-aws-infra-phase1.md`

## 구성 리소스

VPC(사설 서브넷 2) · RDS Postgres t4g.micro · Cognito User Pool · S3(비공개) ·
ECR · IAM(App Runner Access/Instance 역할) · Secrets Manager · App Runner(+VPC Connector)

CloudFront 없음(소규모라 생략, 나중 무중단 추가). 메일은 Resend 외부 유지.

> ⚠️ **리전 = 도쿄(ap-northeast-1).** App Runner가 서울(ap-northeast-2)에 없어서 전부 도쿄로 통일(VPC Connector는 같은 리전만). 한국↔도쿄 지연 ~30ms. 단, **Terraform 상태 버킷만 서울(ap-northeast-2)**에 둔다(백엔드 리전은 리소스 리전과 별개).

## 선결 조건 (1회)

- AWS 계정 (RDS/Cognito 프리티어는 **신규 계정 12개월 내**)
- `aws configure`(또는 SSO) 후 아래가 내 계정을 출력해야 함:
  ```bash
  aws sts get-caller-identity
  ```
- Terraform >= 1.10, Docker, AWS CLI v2

## 실행 순서

### 0. 상태 버킷 부트스트랩 (1회)

`<suffix>`는 본인 고유값(예: 계정ID 뒤 6자리).

```bash
aws s3api create-bucket --bucket pokeca-tfstate-<suffix> \
  --region ap-northeast-2 \
  --create-bucket-configuration LocationConstraint=ap-northeast-2
aws s3api put-bucket-versioning --bucket pokeca-tfstate-<suffix> \
  --versioning-configuration Status=Enabled
```

그리고 `backend.tf`의 `<suffix>`를 같은 값으로 수정.

### 1. init + 1차 apply (App Runner OFF)

```bash
terraform init
terraform plan      # App Runner 리소스는 0개(enable_app_runner=false)
terraform apply     # VPC·RDS·Cognito·S3·ECR·IAM·Secrets 생성 (RDS는 5~10분)
```

### 2. 헬스체크 이미지 빌드·푸시

> ⚠️ **함정 2개 주의:**
> - **macOS keychain 멈춤:** `docker login`이 `credsStore: desktop` 때문에 비대화형에서 멈춘다. `DOCKER_CONFIG`를 임시 디렉터리로 우회.
> - **zsh 모디파이어:** `"$ECR_URL:latest"`는 zsh가 `:l`을 소문자 모디파이어로 해석해 태그가 깨진다. 반드시 `"${ECR_URL}:latest"`(중괄호).

```bash
ECR_URL=$(terraform output -raw ecr_repository_url)
ACCOUNT=$(aws sts get-caller-identity --profile artpoke --query Account --output text)

# keychain 우회용 임시 docker config
export DOCKER_CONFIG=/tmp/pokeca-dockercfg
mkdir -p "$DOCKER_CONFIG" && echo '{}' > "$DOCKER_CONFIG/config.json"

aws ecr get-login-password --region ap-northeast-1 \
  | docker login --username AWS --password-stdin "${ACCOUNT}.dkr.ecr.ap-northeast-1.amazonaws.com"
docker build --platform linux/amd64 -t "${ECR_URL}:latest" healthcheck/   # App Runner는 x86_64
docker push "${ECR_URL}:latest"
```

### 3. 2차 apply (App Runner ON) + 검증

```bash
terraform apply -var enable_app_runner=true

# RUNNING 대기 (수 분)
SVC_ARN=$(terraform output -raw apprunner_service_arn)
for i in $(seq 1 30); do
  st=$(aws apprunner describe-service --service-arn "$SVC_ARN" --query 'Service.Status' --output text)
  echo "status=$st"; [ "$st" = "RUNNING" ] && break; sleep 20
done

# 핵심 검증: DB OK 떠야 성공
URL=$(terraform output -raw apprunner_url)
for i in $(seq 1 30); do out=$(curl -s "$URL/health"); echo "$out"; [ "$out" = "DB OK" ] && break; sleep 20; done
```

## 비용 (월, 대략)

RDS 프리티어 $0(이후 ~$12) + App Runner ~$0–5 + Cognito ~$0 + S3/Secrets ~$1–3
→ **~$5–15**. 프리티어 조건: 신규 계정·단일 AZ·gp2·≤20GB.

## 정리 (비용 폭주 방지)

```bash
terraform destroy   # 전체 삭제. 다시 쓰려면 위 1~3 재실행.
```

## 주의

- `backend.tf`의 상태 버킷은 Terraform이 관리하지 않음(수동 부트스트랩).
- `terraform validate`는 `init` 후에만 됨. `init` 전엔 `terraform fmt`만.
- `server.js`의 `ssl.rejectUnauthorized:false`는 Phase 1 연결 확인용 — Phase 2에서 CA 검증으로 올릴 것.
