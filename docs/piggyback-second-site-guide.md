# 같은 AWS 인프라에 두 번째 사이트 "기생"시키기 가이드

> art-poke(pokeca)가 세운 AWS 기반 위에 **완전히 다른 웹사이트**를 얹는다. 비싼 공용 자원(VPC·NAT·RDS·상태버킷·Route53)은 **공유**하고, 사이트별로 격리돼야 하는 것(Lambda·API GW·CloudFront·S3·DB·Terraform 상태)만 **새로** 만든다.
> 핵심 원칙: **Terraform 상태는 반드시 분리**(공유하면 한쪽 `apply`/`destroy`가 다른 쪽을 날린다). 공유 자원은 pokeca 상태에서 **output으로 노출 → remote_state로 참조**한다.

**계정/리전 고정**: AWS `--profile artpoke`(계정 `138681986450`), 리전 `ap-northeast-1`(도쿄), 상태버킷 `pokeca-tfstate-138681986450`(서울 `ap-northeast-2`). ACM(CloudFront용)만 `us-east-1`. 회사 계정 절대 금지.

---

## 0. 공유 vs 신규 한눈에

| 자원 | 공유(재사용) | 신규(사이트별) | 비고 |
|---|---|---|---|
| VPC·서브넷·IGW·라우트 | ✅ | | `aws_vpc.main`, `aws_subnet.private/public` |
| NAT 인스턴스(fck-nat) | ✅ | | 아웃바운드 공용. 월 ~3천원, 추가비용 0 |
| RDS 인스턴스 | ✅ 인스턴스 | ✅ **DB+유저 신규** | 같은 Postgres에 `CREATE DATABASE`. 새 RDS 금지(월 ~$12 절약) |
| Terraform 상태버킷 | ✅ 버킷 | ✅ **key 분리** | 같은 버킷, `key="site2/terraform.tfstate"` |
| Route53 호스티드존 | ✅ | ✅ 레코드 | `data aws_route53_zone.main` |
| Secrets Manager | 패턴 | ✅ 시크릿 | 사이트별 DB URL·앱 시크릿 |
| Lambda(server/image) | | ✅ | OpenNext. 유휴 0원 |
| API Gateway HTTP API | | ✅ | |
| CloudFront + ACM | | ✅ | ACM은 us-east-1 |
| S3(assets/uploads) | | ✅ | |
| IAM 역할(lambda) | | ✅ | VPC+S3 권한 |
| 보안그룹 | RDS SG 참조 | ✅ lambda SG | 새 lambda SG를 RDS SG inbound(5432)에 허용 |

**결론: 두 번째 사이트 추가 비용 ≈ $0** (Lambda 유휴 0, CloudFront/S3 사용량 과금, DB·NAT·VPC·RDS 공유). 트래픽 생기면 그만큼만.

---

## 1. 선행 — pokeca 인프라에 공용 output 추가 (1회)

pokeca `infra/outputs.tf`는 지금 RDS 주소·S3만 노출한다. 기생 사이트가 VPC/서브넷/SG/NAT를 참조하려면 아래를 추가하고 `AWS_PROFILE=artpoke terraform apply`(공유 상태). output만 추가라 기존 리소스 변경 없음.

```hcl
# infra/outputs.tf 에 추가
output "vpc_id"              { value = aws_vpc.main.id }
output "private_subnet_ids"  { value = aws_subnet.private[*].id }
output "rds_security_group_id" { value = aws_security_group.rds.id }
output "rds_endpoint"        { value = aws_db_instance.main.address }   # 이미 있으면 생략
output "route53_zone_id"     { value = data.aws_route53_zone.main.zone_id }
output "tfstate_bucket"      { value = "pokeca-tfstate-138681986450" }
```

> 대안: output 안 건드리고 새 사이트에서 `data "aws_vpc"`/`data "aws_subnets"`를 **태그로 조회**해도 된다. 하지만 remote_state가 계약이 명확해 권장.

---

## 2. 두 번째 사이트 Terraform 뼈대

새 repo(또는 `사이트2/infra/`)에 둔다. **상태 key만 다르면** 같은 버킷을 써도 완전 독립이다.

```hcl
# backend.tf — ⚠️ key가 pokeca와 달라야 한다
terraform {
  backend "s3" {
    bucket       = "pokeca-tfstate-138681986450"
    key          = "site2/terraform.tfstate"   # ← pokeca는 phase1/..., 반드시 분리
    region       = "ap-northeast-2"
    encrypt      = true
    use_lockfile = true
  }
}

# providers.tf
provider "aws" { region = "ap-northeast-1" }          # 리소스
provider "aws" { alias = "us_east_1"; region = "us-east-1" }  # ACM(CloudFront)

# shared.tf — pokeca 공유 자원을 remote_state로 읽는다
data "terraform_remote_state" "pokeca" {
  backend = "s3"
  config = {
    bucket = "pokeca-tfstate-138681986450"
    key    = "phase1/terraform.tfstate"
    region = "ap-northeast-2"
  }
}
locals {
  vpc_id      = data.terraform_remote_state.pokeca.outputs.vpc_id
  subnet_ids  = data.terraform_remote_state.pokeca.outputs.private_subnet_ids
  rds_sg_id   = data.terraform_remote_state.pokeca.outputs.rds_security_group_id
  rds_host    = data.terraform_remote_state.pokeca.outputs.rds_endpoint
  zone_id     = data.terraform_remote_state.pokeca.outputs.route53_zone_id
}
```

만들 리소스(파일 분리 권장): `vpc-glue.tf`(lambda SG + RDS SG ingress), `rds-db.tf`(없음 — DB는 SQL로, 아래 3장), `secrets.tf`, `lambda.tf`(server+image), `api.tf`(API GW 2개), `cloudfront.tf`(배포+ACM+OAC), `s3.tf`(assets), `iam.tf`, `domain.tf`, `migrate.tf`(마이그레이션 Lambda).

**pokeca/infra의 동명 파일을 복사해 이름만 site2로 바꾸는 게 가장 빠르다.** (app.tf→lambda.tf, api.tf, cloudfront.tf, s3.tf, iam.tf, domain.tf, lambda-migrate/)

### 보안그룹 연결 (새 lambda → 공유 RDS)
```hcl
resource "aws_security_group" "lambda" {
  name_prefix = "site2-lambda-"
  vpc_id      = local.vpc_id
  egress { from_port=0 to_port=0 protocol="-1" cidr_blocks=["0.0.0.0/0"] }
}
# 공유 RDS SG에 새 lambda SG 인바운드 허용(5432)
resource "aws_security_group_rule" "rds_from_site2" {
  type=            "ingress"
  from_port=       5432
  to_port=         5432
  protocol=        "tcp"
  security_group_id=        local.rds_sg_id      # 공유 RDS SG
  source_security_group_id= aws_security_group.lambda.id
}
```

---

## 3. DB 격리 — 같은 RDS, 새 데이터베이스

새 RDS를 띄우지 말고 **기존 인스턴스에 DB+유저를 추가**한다. RDS는 프라이빗이라 노트북에서 직접 못 붙으니 **마이그레이션 Lambda**(VPC 안)로 실행한다(pokeca `infra/lambda-migrate/` 패턴 복제).

1. 부트스트랩 SQL(한 번) — 마이그레이션 Lambda의 첫 파일로:
   ```sql
   -- 00_site2_db.sql  (master=pokeca_admin 권한으로 실행)
   create database site2;
   create user site2_app with password '<secrets로 주입>';
   grant all privileges on database site2 to site2_app;
   ```
   > master 유저(`pokeca_admin`)로 접속해 DB 생성 → 이후 site2_app으로 스키마/데이터.
2. 앱은 `DATABASE_URL = postgres://site2_app:***@<rds_host>:5432/site2?sslmode=require`. SSL 필수(ADR-A16).
3. 스키마·시드는 pokeca처럼 `infra/db/migrations/*.sql` + migrate Lambda `invoke`로.

> 완전 격리를 원하면 새 RDS 인스턴스도 가능하지만 월 ~$12 추가. 소규모면 **같은 인스턴스 다른 DB**가 정석.

---

## 4. 도메인·배포

- **도메인**: Route53 같은 존에 새 서브도메인/도메인 레코드. CloudFront용 **ACM 인증서는 us-east-1**(provider alias).
- **배포 스크립트**: pokeca `scripts/deploy.sh` 복제. 반드시 `AWS_PROFILE=artpoke`, 계정 가드(`138681986450`) 유지. 흐름: OpenNext build → zip(.cache 제외) → **app-server.zip은 S3 업로드**(70MB 한도) → `terraform apply` → assets S3 sync → CloudFront invalidation.
- 첫 배포 순서: `terraform init && apply`(인프라) → migrate Lambda로 DB 부트스트랩+스키마 → deploy.sh(앱) → 스모크.

---

## 5. 반드시 지킬 함정 (pokeca에서 겪은 것 재탕 금지)

- **상태 key 분리** — 가장 중요. 같은 key 쓰면 두 사이트가 서로를 덮어씀/삭제함.
- `AWS_PROFILE=artpoke` 고정, 계정 `138681986450` 가드. 회사 계정 금지.
- 리전 도쿄, **ACM만 us-east-1**.
- OpenNext Lambda zip **70MB 초과 → S3 경유**(`s3_bucket/s3_key`). 루트 `.cache`는 zip에서 `-x '.cache/*'` 제외.
- 신규계정 **공개 Function URL 403** → API Gateway + CloudFront로 감싸기(pokeca와 동일).
- 프라이빗 RDS → **마이그레이션 Lambda**로만 스키마 변경. (로컬 `db:migrate`는 `node --import tsx`로 — node20 `.mts` 이슈.)
- VPC Lambda 아웃바운드(OAuth/외부 API)는 **공유 NAT** 경유 — 새 lambda SG egress 열려 있어야 함.
- RDS 비용: 커넥션 급증 시 Lambda 동시성 상한 또는 RDS Proxy.
- git push 전 `gh` 활성 계정 **`clyde-yoonjae`** 확인(`gh auth switch`).

---

## 6. 체크리스트

- [ ] pokeca `infra/outputs.tf`에 vpc/subnet/rds_sg/zone output 추가 → `apply`(공유 상태)
- [ ] site2 `backend.tf` key=`site2/...`, `terraform_remote_state`로 pokeca output 참조
- [ ] 새 lambda SG + 공유 RDS SG ingress(5432)
- [ ] 마이그레이션 Lambda로 `create database site2` + user + 스키마
- [ ] Secrets에 `DATABASE_URL`(site2, sslmode=require) + 앱 시크릿
- [ ] Lambda(server/image) + API GW + CloudFront + ACM(us-east-1) + 도메인
- [ ] deploy.sh 복제(프로필/계정 가드 유지), 첫 배포 → 스모크
- [ ] 비용 확인(추가 ≈ CloudFront/S3 사용량 + DB 공유 0)
