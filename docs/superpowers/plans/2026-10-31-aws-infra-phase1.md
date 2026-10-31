# AWS 인프라 Phase 1 (인프라 골대) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Terraform으로 art-poke용 AWS 리소스(VPC·RDS·Cognito·S3·ECR·IAM·Secrets·App Runner)를 세우고, 빈 헬스체크 컨테이너가 App Runner 공개 URL에서 "DB OK"를 응답해 "App Runner→VPC→RDS" 배선을 증명한다.

**Architecture:** 사설 서브넷 2개짜리 최소 VPC 안에 RDS Postgres(t4g.micro). App Runner는 VPC Connector로 사설망의 RDS에 접속(공개 URL은 App Runner 관리형, VPC 밖). IGW/NAT 없음(Phase 1 컨테이너는 RDS만 필요, Secrets는 App Runner 컨트롤플레인이 instance role로 주입). ECR 닭-달걀은 `enable_app_runner` 플래그로 2단계 apply.

**Tech Stack:** Terraform ≥1.10 (S3 네이티브 잠금), AWS provider(ap-northeast-2), Node 20 + `pg`(헬스체크 컨테이너), Docker, ECR.

---

## 선결 조건 (사람이 1회, 코드 아님)

> ⚠️ **현재 로컬 AWS 자격증명이 무효(`InvalidClientTokenId`)다.** Task 1~9(코드 작성·`terraform validate`)는 자격증명 없이 가능하지만, Task 10 이후(`terraform init/plan/apply`, 실자원 생성)는 아래가 끝나야 한다.

- AWS 계정 (RDS/Cognito 프리티어는 신규 계정 12개월 내)
- `aws configure`(또는 SSO) 후 `aws sts get-caller-identity`가 계정을 출력
- 리전 `ap-northeast-2` (서울)

## File Structure

모든 경로는 `pokeca/` 기준. 신규 디렉터리 `infra/`.

```
infra/
├── README.md              # 초보자용 재현 가이드(명령어 순서)
├── versions.tf            # required_version >= 1.10, provider 버전 핀
├── providers.tf           # AWS provider, 리전, 공통 태그
├── backend.tf             # S3 백엔드(네이티브 잠금, DynamoDB 없음)
├── variables.tf           # project_name, region, db_name, enable_app_runner
├── vpc.tf                 # VPC + 사설 서브넷 2 + 보안그룹 2
├── rds.tf                 # Postgres t4g.micro + 서브넷그룹 + random_password
├── secrets.tf             # Secrets Manager (DB 자격증명 JSON)
├── cognito.tf             # User Pool + App Client
├── s3.tf                  # 업로드 버킷(비공개)
├── ecr.tf                 # 이미지 저장소
├── iam.tf                 # App Runner Access Role(ECR) + Instance Role(Secrets)
├── apprunner.tf           # App Runner + VPC Connector (count=enable_app_runner)
├── outputs.tf             # URL·엔드포인트·풀 ID
└── healthcheck/
    ├── Dockerfile         # node:20-alpine + pg
    ├── package.json
    └── server.js          # /health → DB_SECRET 파싱 → RDS SELECT 1 → "DB OK"
```

각 파일 책임이 하나씩 분리됨(네트워크/DB/인증/스토리지/권한/실행). 함께 바뀌는 것끼리 묶음.

---

## Task 1: Terraform 스켈레톤 (versions / providers / variables)

**Files:**
- Create: `infra/versions.tf`, `infra/providers.tf`, `infra/variables.tf`

- [ ] **Step 1: `infra/versions.tf` 작성**

```hcl
terraform {
  required_version = ">= 1.10"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.70" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}
```

- [ ] **Step 2: `infra/providers.tf` 작성**

```hcl
provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "terraform"
    }
  }
}
```

- [ ] **Step 3: `infra/variables.tf` 작성**

```hcl
variable "project_name" {
  type    = string
  default = "pokeca"
}

variable "region" {
  type    = string
  default = "ap-northeast-2"
}

variable "db_name" {
  type    = string
  default = "pokeca"
}

variable "db_username" {
  type    = string
  default = "pokeca_admin"
}

# ECR 닭-달걀: 이미지 푸시 전에는 false로 apply(App Runner 생성 안 함),
# 푸시 후 true로 다시 apply.
variable "enable_app_runner" {
  type    = bool
  default = false
}
```

- [ ] **Step 4: 포맷**

Run: `cd infra && terraform fmt`
Expected: fmt가 한 줄 블록 등을 정리하며 파일명 출력(정상). 에러 없음. (`-check`는 재정렬이 필요하면 비정상 종료코드를 내므로 쓰지 않는다. `terraform validate`는 provider 초기화가 필요해 Task 10 `init` 전까지 못 돌린다 — 인자명 오타는 Task 10에서 처음 잡히니, 필요하면 Task 1~9로 되돌아와 고친다.)

- [ ] **Step 5: Commit**

```bash
git add infra/versions.tf infra/providers.tf infra/variables.tf
git commit -m "infra: terraform 스켈레톤(providers/versions/variables)"
```

---

## Task 2: VPC + 서브넷 + 보안그룹

**Files:**
- Create: `infra/vpc.tf`

- [ ] **Step 1: `infra/vpc.tf` 작성**

```hcl
data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "${var.project_name}-vpc" }
}

# 사설 서브넷 2개(RDS 서브넷그룹은 서로 다른 AZ 2개 이상 필요).
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 1)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags              = { Name = "${var.project_name}-private-${count.index}" }
}

# App Runner VPC Connector가 붙는 보안그룹(egress만).
resource "aws_security_group" "apprunner" {
  name        = "${var.project_name}-apprunner-sg"
  description = "App Runner VPC connector egress"
  vpc_id      = aws_vpc.main.id
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${var.project_name}-apprunner-sg" }
}

# RDS 보안그룹: App Runner SG에서 오는 5432만 허용.
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Postgres from App Runner only"
  vpc_id      = aws_vpc.main.id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.apprunner.id]
  }
  tags = { Name = "${var.project_name}-rds-sg" }
}
```

- [ ] **Step 2: 검증(자격증명 불필요)**

Run: `cd infra && terraform fmt && terraform validate` — *단, validate는 provider 초기화가 필요하므로 Task 10 init 전에는 `terraform fmt`만.*
Expected: fmt 통과.

- [ ] **Step 3: Commit**

```bash
git add infra/vpc.tf
git commit -m "infra: 최소 VPC(사설 서브넷 2 + 보안그룹 2)"
```

---

## Task 3: RDS Postgres + Secrets Manager

**Files:**
- Create: `infra/rds.tf`, `infra/secrets.tf`

- [ ] **Step 1: `infra/rds.tf` 작성**

```hcl
resource "random_password" "db" {
  length  = 24
  special = false # URL/JSON 취급 편의상 특수문자 제외
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnets"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db"
  engine         = "postgres"
  engine_version = "16"

  # 프리티어 조건: 신규 계정·단일 AZ·gp2·20GB.
  instance_class        = "db.t4g.micro"
  allocated_storage     = 20
  storage_type          = "gp2"
  multi_az              = false
  publicly_accessible   = false

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  skip_final_snapshot = true # Phase 1 골대라 스냅샷 생략(비용·속도). 운영 전환 시 false로.
  deletion_protection = false
  apply_immediately   = true # Phase 1: 변경 즉시 반영(유지보수 창 대기 안 함).

  # auto_minor_version_upgrade(기본 true)가 마이너를 올리면 다음 plan에 허위 드리프트가
  # 생긴다. Phase 1은 메이저만 고정하고 마이너 변화는 무시.
  lifecycle {
    ignore_changes = [engine_version]
  }

  tags = { Name = "${var.project_name}-db" }
}
```

- [ ] **Step 2: `infra/secrets.tf` 작성**

```hcl
resource "aws_secretsmanager_secret" "db" {
  name = "${var.project_name}/db"
}

# 컨테이너에 통째로 주입할 JSON. server.js가 파싱한다.
resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = aws_db_instance.main.username
    password = random_password.db.result
    host     = aws_db_instance.main.address
    port     = aws_db_instance.main.port
    dbname   = aws_db_instance.main.db_name
  })
}
```

- [ ] **Step 3: fmt**

Run: `cd infra && terraform fmt`
Expected: 통과.

- [ ] **Step 4: Commit**

```bash
git add infra/rds.tf infra/secrets.tf
git commit -m "infra: RDS Postgres t4g.micro + Secrets Manager(DB 자격증명 JSON)"
```

---

## Task 4: Cognito User Pool

**Files:**
- Create: `infra/cognito.tf`

- [ ] **Step 1: `infra/cognito.tf` 작성**

```hcl
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-users"

  # Phase 1은 빈 풀. Phase 2에서 로그인 흐름 연결.
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_uppercase = true
    require_symbols   = false
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name            = "${var.project_name}-web"
  user_pool_id    = aws_cognito_user_pool.main.id
  generate_secret = false # 브라우저/SSR 공개 클라이언트
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]
}
```

- [ ] **Step 2: fmt + Commit**

```bash
cd infra && terraform fmt
git add infra/cognito.tf
git commit -m "infra: Cognito User Pool + App Client(빈 풀)"
```

---

## Task 5: S3 업로드 버킷 (비공개)

**Files:**
- Create: `infra/s3.tf`

- [ ] **Step 1: `infra/s3.tf` 작성**

```hcl
resource "aws_s3_bucket" "uploads" {
  bucket = "${var.project_name}-uploads-${data.aws_caller_identity.current.account_id}"
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration { status = "Enabled" }
}
```

- [ ] **Step 2: fmt + Commit**

```bash
cd infra && terraform fmt
git add infra/s3.tf
git commit -m "infra: S3 업로드 버킷(비공개 + 버전관리)"
```

---

## Task 6: ECR 이미지 저장소

**Files:**
- Create: `infra/ecr.tf`

- [ ] **Step 1: `infra/ecr.tf` 작성**

```hcl
resource "aws_ecr_repository" "app" {
  name                 = "${var.project_name}-app"
  image_tag_mutability = "MUTABLE"
  force_delete         = true # Phase 1 destroy 편의. 운영 전환 시 false로.
  image_scanning_configuration { scan_on_push = true }
}
```

- [ ] **Step 2: fmt + Commit**

```bash
cd infra && terraform fmt
git add infra/ecr.tf
git commit -m "infra: ECR 저장소"
```

---

## Task 7: IAM 역할 2개 (App Runner Access / Instance)

**Files:**
- Create: `infra/iam.tf`

- [ ] **Step 1: `infra/iam.tf` 작성**

```hcl
# (1) Access Role: App Runner 빌드 서비스가 ECR에서 이미지 pull.
data "aws_iam_policy_document" "apprunner_build_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["build.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "apprunner_access" {
  name               = "${var.project_name}-apprunner-access"
  assume_role_policy = data.aws_iam_policy_document.apprunner_build_assume.json
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr" {
  role       = aws_iam_role.apprunner_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# (2) Instance Role: 실행 태스크가 Secrets Manager의 DB 시크릿 읽기(런타임 주입).
data "aws_iam_policy_document" "apprunner_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["tasks.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "apprunner_instance" {
  name               = "${var.project_name}-apprunner-instance"
  assume_role_policy = data.aws_iam_policy_document.apprunner_tasks_assume.json
}

data "aws_iam_policy_document" "read_db_secret" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.db.arn]
  }
}

resource "aws_iam_role_policy" "apprunner_secret" {
  name   = "read-db-secret"
  role   = aws_iam_role.apprunner_instance.id
  policy = data.aws_iam_policy_document.read_db_secret.json
}
```

- [ ] **Step 2: fmt + Commit**

```bash
cd infra && terraform fmt
git add infra/iam.tf
git commit -m "infra: App Runner IAM 역할(ECR pull + Secrets read)"
```

---

## Task 8: 헬스체크 컨테이너

**Files:**
- Create: `infra/healthcheck/Dockerfile`, `infra/healthcheck/package.json`, `infra/healthcheck/server.js`

- [ ] **Step 1: `infra/healthcheck/package.json` 작성**

```json
{
  "name": "pokeca-healthcheck",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": { "pg": "^8.13.0" }
}
```

- [ ] **Step 2: `infra/healthcheck/server.js` 작성**

```js
import http from "node:http";
import pg from "pg";

const port = process.env.PORT || 8080;

async function checkDb() {
  const raw = process.env.DB_SECRET;
  if (!raw) return { ok: false, msg: "DB_SECRET 미주입" };
  const { username, password, host, port: dbPort, dbname } = JSON.parse(raw);
  const client = new pg.Client({
    user: username,
    password,
    host,
    port: dbPort,
    database: dbname,
    ssl: { rejectUnauthorized: false }, // RDS 기본 TLS
    connectionTimeoutMillis: 4000,
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return { ok: true, msg: "DB OK" };
  } catch (e) {
    return { ok: false, msg: `DB FAIL: ${e.message}` };
  } finally {
    await client.end().catch(() => {});
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    const r = await checkDb();
    res.writeHead(r.ok ? 200 : 503, { "content-type": "text/plain" });
    res.end(r.msg);
    return;
  }
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("pokeca healthcheck");
});

server.listen(port, () => console.log(`listening on ${port}`));
```

- [ ] **Step 3: `infra/healthcheck/Dockerfile` 작성**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
EXPOSE 8080
CMD ["node", "server.js"]
```

- [ ] **Step 4: 로컬 문법 점검(선택, DB 없이)**

Run: `cd infra/healthcheck && node --check server.js`
Expected: 출력 없음(문법 OK).

- [ ] **Step 5: Commit**

```bash
git add infra/healthcheck/
git commit -m "infra: 헬스체크 컨테이너(/health → RDS SELECT 1 → DB OK)"
```

---

## Task 9: App Runner + VPC Connector + outputs

**Files:**
- Create: `infra/apprunner.tf`, `infra/outputs.tf`

- [ ] **Step 1: `infra/apprunner.tf` 작성**

```hcl
resource "aws_apprunner_vpc_connector" "main" {
  count              = var.enable_app_runner ? 1 : 0
  vpc_connector_name = "${var.project_name}-connector"
  subnets            = aws_subnet.private[*].id
  security_groups    = [aws_security_group.apprunner.id]
}

resource "aws_apprunner_service" "main" {
  count        = var.enable_app_runner ? 1 : 0
  service_name = "${var.project_name}-app"

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_access.arn
    }
    image_repository {
      image_identifier      = "${aws_ecr_repository.app.repository_url}:latest"
      image_repository_type = "ECR"
      image_configuration {
        port = "8080"
        runtime_environment_secrets = {
          DB_SECRET = aws_secretsmanager_secret.db.arn
        }
      }
    }
    auto_deployments_enabled = true
  }

  instance_configuration {
    cpu               = "256"  # 0.25 vCPU
    memory            = "512"  # 0.5 GB
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  health_check_configuration {
    protocol = "HTTP"
    path     = "/health"
    interval = 10
    timeout  = 5
  }

  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = aws_apprunner_vpc_connector.main[0].arn
    }
  }
}
```

- [ ] **Step 2: `infra/outputs.tf` 작성**

```hcl
output "apprunner_url" {
  value       = var.enable_app_runner ? "https://${aws_apprunner_service.main[0].service_url}" : "(enable_app_runner=false)"
  description = "App Runner 공개 URL"
}

output "apprunner_service_arn" {
  value       = var.enable_app_runner ? aws_apprunner_service.main[0].arn : ""
  description = "App Runner 서비스 ARN(상태 폴링용)"
}

output "rds_endpoint" {
  value = aws_db_instance.main.address
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_web_client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "s3_uploads_bucket" {
  value = aws_s3_bucket.uploads.bucket
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}
```

- [ ] **Step 3: fmt + Commit**

```bash
cd infra && terraform fmt
git add infra/apprunner.tf infra/outputs.tf
git commit -m "infra: App Runner + VPC Connector(플래그 게이트) + outputs"
```

---

## Task 10: 상태 백엔드 부트스트랩 + init + 1차 apply (App Runner OFF)

> 🔐 여기부터 **유효한 AWS 자격증명 필요**. `aws sts get-caller-identity` 성공 확인 먼저.

**Files:**
- Create: `infra/backend.tf`

- [ ] **Step 1: 상태 버킷 1회 부트스트랩** (`<suffix>`는 본인 고유값, 예: 계정ID 뒤 6자리)

```bash
aws s3api create-bucket --bucket pokeca-tfstate-<suffix> \
  --region ap-northeast-2 \
  --create-bucket-configuration LocationConstraint=ap-northeast-2
aws s3api put-bucket-versioning --bucket pokeca-tfstate-<suffix> \
  --versioning-configuration Status=Enabled
```

- [ ] **Step 2: `infra/backend.tf` 작성** (버킷명에 위 `<suffix>` 반영)

```hcl
terraform {
  backend "s3" {
    bucket       = "pokeca-tfstate-<suffix>"
    key          = "phase1/terraform.tfstate"
    region       = "ap-northeast-2"
    encrypt      = true
    use_lockfile = true # Terraform 1.10+ S3 네이티브 잠금(DynamoDB 불필요)
  }
}
```

- [ ] **Step 3: init + validate**

Run: `cd infra && terraform init && terraform validate`
Expected: `Terraform has been successfully initialized!` + `Success! The configuration is valid.`

- [ ] **Step 4: plan (App Runner 제외 상태)**

Run: `terraform plan`
Expected: VPC·RDS·Cognito·S3·ECR·IAM·Secrets 생성 계획. App Runner 리소스는 `enable_app_runner=false`라 **0개**. `Plan: N to add`.

- [ ] **Step 5: apply**

Run: `terraform apply` → `yes`
Expected: 모든 리소스 생성 완료(RDS는 수 분 소요). `Apply complete!` + outputs 출력.

- [ ] **Step 6: Commit**

```bash
git add infra/backend.tf
git commit -m "infra: S3 상태 백엔드 + 1차 apply(App Runner off)"
```

---

## Task 11: 이미지 빌드·푸시 → 2차 apply (App Runner ON) → "DB OK" 검증

- [ ] **Step 1: ECR 로그인 + 빌드 + 푸시**

```bash
cd infra
ECR_URL=$(terraform output -raw ecr_repository_url)
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region ap-northeast-2 \
  | docker login --username AWS --password-stdin "${ACCOUNT}.dkr.ecr.ap-northeast-2.amazonaws.com"
docker build --platform linux/amd64 -t "$ECR_URL:latest" healthcheck/
docker push "$ECR_URL:latest"
```

Expected: `latest: digest: sha256:...` 푸시 성공. (App Runner는 x86_64라 `--platform linux/amd64` 필수)

- [ ] **Step 2: App Runner 켜고 2차 apply**

Run: `terraform apply -var enable_app_runner=true` → `yes`
Expected: VPC Connector + App Runner 서비스 생성. `Apply complete!`

- [ ] **Step 3: App Runner가 RUNNING 될 때까지 대기 (수 분)**

`apply`는 서비스가 완전히 뜨기 전에 반환될 수 있다. 상태가 `RUNNING`이어야 curl이 의미 있다.

```bash
SVC_ARN=$(terraform output -raw apprunner_service_arn 2>/dev/null) || true
# 상태 폴링(최대 ~10분)
for i in $(seq 1 30); do
  st=$(aws apprunner describe-service --service-arn "$SVC_ARN" \
        --query 'Service.Status' --output text 2>/dev/null)
  echo "status=$st"; [ "$st" = "RUNNING" ] && break; sleep 20
done
```

Expected: 최종 `status=RUNNING`.

- [ ] **Step 4: 공개 URL 헬스체크 (핵심 검증, 재시도 포함)**

```bash
URL=$(terraform output -raw apprunner_url)
for i in $(seq 1 30); do
  out=$(curl -s "$URL/health"); echo "$out"
  [ "$out" = "DB OK" ] && break; sleep 20
done
```

Expected: **`DB OK`** (= App Runner → VPC Connector → RDS 배선 증명). 계속 `DB FAIL: ...`면 메시지로 원인(보안그룹 5432, 서브넷 AZ, 시크릿 주입) 파악.

- [ ] **Step 5: MCP(aws-api)로 교차 검증**

App Runner 서비스 상태 `RUNNING`, RDS `available`, Cognito 풀 존재를 MCP 조회로 확인(읽기 전용).

- [ ] **Step 6: DoD 체크 기록** — 설계 문서 §10 항목 전부 충족 확인.

---

## Task 12: README + destroy 리허설

**Files:**
- Create: `infra/README.md`

- [ ] **Step 1: `infra/README.md` 작성** — 전제조건 → 상태버킷 부트스트랩 → `init` → `apply`(off) → 이미지 push → `apply -var enable_app_runner=true` → `curl /health` → `terraform destroy` 순서를 그대로 명령어로. 비용 주의(프리티어 조건), destroy로 전체 정리 가능함을 명시.

- [ ] **Step 2: destroy로 비용 폭주 방지 확인 (선택이지만 강력 권장)**

Run: `cd infra && terraform destroy` → `yes`
Expected: 전체 삭제. (다시 쓰려면 Task 10~11 재실행) — *운영 전환(Phase 2)을 바로 이어갈 거면 생략 가능.*

- [ ] **Step 3: Commit**

```bash
git add infra/README.md
git commit -m "infra: 초보자용 README(재현·비용·destroy 가이드)"
```

---

## 완료 기준 (설계 §10과 동일)

- [ ] 전제조건 + 상태버킷 부트스트랩 완료
- [ ] `terraform plan` 에러 없이 전체 계획 출력
- [ ] `apply`로 VPC·RDS·Cognito·S3·Secrets·ECR·IAM(2역할)·App Runner 생성
- [ ] App Runner가 ECR pull(Access Role) + Secrets 주입(Instance Role) 성공
- [ ] `curl $URL/health` → **DB OK**
- [ ] outputs가 URL·RDS·Cognito·ECR 출력
- [ ] MCP 교차 검증
- [ ] README 재현 가이드
- [ ] `terraform destroy`로 정리 가능 확인
