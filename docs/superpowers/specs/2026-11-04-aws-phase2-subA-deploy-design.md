# 설계: AWS Phase 2 서브 A — 앱 배포 (OpenNext + Lambda + CloudFront)

- 작성일: 2026-11-04 (브레인스토밍 승인 완료)
- 리전: 도쿄 `ap-northeast-1` (상태버킷만 서울). 프로파일 **artpoke** (계정 138681986450, 회사 gr-readonly 금지).
- 선행 완료: Phase 1(VPC/RDS/S3/ECR/IAM), 서브 B(스키마), 서브 C(Auth.js+Drizzle), 서브 D(S3 스토리지), 유저=작가 재설계.
- 결정 근거/대화 기록: `docs/superpowers/2026-11-04-subA-deploy-decisions.md`

## 목표
Next 16 앱을 Vercel 없이 AWS 네이티브 **서버리스**로 배포한다. 첫 배포는 CloudFront 기본 도메인(`*.cloudfront.net`)으로 라이브, 커스텀 도메인은 나중(도메인 등록 후).

## 아키텍처
```
사용자 → CloudFront (xxxx.cloudfront.net)
          ├─ /_next/static/*, 정적 자산       → S3 assets 버킷 (OAC, 비공개)
          ├─ 그 외(SSR/API/Server Action)     → Lambda: OpenNext server fn (Function URL 오리진)
          └─ /_next/image                      → Lambda: OpenNext image fn (필요 시)
작품/아바타 이미지 → CloudFront + OAC 로 S3 비공개 서빙 (서브 D 이월)
Lambda → VPC(프라이빗 서브넷) → RDS 직결
Lambda → NAT 인스턴스(t4g.nano) → 인터넷 (카카오·구글 토큰 교환)
```

## 컴포넌트 / 인프라 추가 (infra/ Terraform)

### 1. 네트워크 (`infra/vpc.tf` 확장 또는 `infra/nat.tf`)
- 퍼블릭 서브넷 2개(AZ a/c) + **IGW** + 퍼블릭 라우트.
- **NAT 인스턴스** `t4g.nano`(Amazon Linux 2023, `source_dest_check=false`, EIP). 프라이빗 라우트의 0.0.0.0/0 → NAT ENI.
- 근거: VPC Lambda가 RDS(프라이빗) + 카카오/구글(인터넷) 둘 다 필요. NAT Gateway(월 ~4만) 대신 인스턴스(월 ~3천).

### 2. 앱 Lambda (`infra/app.tf`)
- OpenNext 산출물: `server` 함수(필수) + `image` 함수(선택, Next 이미지 최적화). art-poke는 `<img>`+presigned 위주라 image fn은 최소.
- `aws_lambda_function`: VPC(프라이빗 서브넷 + lambda SG), 메모리 1024MB/타임아웃 30s(초기), 환경변수/시크릿.
- `aws_lambda_function_url`(AWS_IAM 또는 NONE+CloudFront 제한). CloudFront가 유일 진입점이 되게.

### 3. S3 assets 버킷 (`infra/app.tf`)
- OpenNext 정적 자산(`.open-next/assets`, `cache`) 업로드 대상. 비공개 + OAC로만 CloudFront 접근.

### 4. CloudFront (`infra/cloudfront.tf`)
- 배포 1개. 오리진: (a) Lambda Function URL = 기본(SSR/API), (b) S3 assets(OAC).
- 비헤이비어: `/_next/static/*`·정적 = S3 장기 캐시, 그 외 = Lambda 패스스루(캐시 최소, 쿠키/헤더 전달).
- 기본 인증서(cloudfront.net) 사용 → ACM 불필요(커스텀 도메인 단계에서 추가).

### 5. 작품 이미지 서빙 CloudFront+OAC (서브 D 이월)
- uploads 버킷을 CloudFront 경유 비공개 서빙(또는 현행 presigned GET 유지 + 후속). 1차는 presigned 유지, 이미지 CDN은 플랜에서 범위 판단.

### 6. IAM (`infra/iam.tf` 확장)
- 앱 Lambda 실행 역할: VPC 관리 + **S3(uploads/evidence) Get/Put/Delete/List/Copy** + Secrets 읽기 + CloudWatch Logs.
- 로컬은 `AWS_PROFILE=artpoke`로 S3 접근했지만 프로드 Lambda는 역할 기반.

### 7. env/시크릿 (`infra/secrets.tf` 확장)
- Secrets Manager 또는 Lambda env: `AUTH_SECRET`, `AUTH_KAKAO_ID/SECRET`, `AUTH_GOOGLE_ID/SECRET`, `DATABASE_URL`, `AWS_REGION`, `S3_BUCKET_UPLOADS/EVIDENCE`.
- DATABASE_URL은 기존 `aws_secretsmanager_secret.db` 재사용.

## 빌드/배포 파이프라인
- `npx open-next build` → `.open-next/`(server/image zip, assets, cache) 생성.
- Terraform: zip → Lambda, assets → S3(동기화), CloudFront 무효화(필요 시).
- 반복: `open-next build` → `terraform apply`.

## 배포 순서 (서브 A DoD)
1. (선행) 프로드 RDS에 유저=작가 마이그레이션 적용: `01_app.sql` → `lambda-migrate/sql/` 복사 → apply → `pokeca-migrate` invoke.
2. 네트워크(퍼블릭 서브넷+IGW+NAT) apply, 프라이빗 라우트 NAT로.
3. OpenNext 빌드 → 앱 Lambda + assets S3 + CloudFront apply.
4. 시크릿 주입 + Lambda IAM S3 권한.
5. `xxxx.cloudfront.net` 스모크: 헬스/정적/SSR 200.
6. 카카오·구글 콘솔에 `https://xxxx.cloudfront.net/api/auth/callback/{kakao,google}` 등록 → 소셜로그인·업로드·어드민 end-to-end 검증.

## 범위 밖 (후속)
- 커스텀 도메인 + ACM(us-east-1) + Route 53 DNS (도메인 등록 후 별도 작업).
- 서브 E 컷오버(DNS 전환 + Vercel/Supabase 해지).
- 데모 시드 스크립트 Supabase→pg 포팅.

## 리스크 / 확인
- `infra/errored.tfstate`(이전 실패 흔적): 플랜 1스텝에서 `terraform plan`으로 상태-실제 정합 확인 후 정리.
- **OpenNext ↔ Next 16 호환**: 플랜에서 지원 버전 핀(미지원이면 버전/우회 결정).
- Lambda 콜드스타트 + VPC ENI: 초기 수용. 압박 시 provisioned concurrency/RDS Proxy 후속.
- NAT 인스턴스 SPOF: 1대로 시작(저트래픽 허용), 필요 시 이중화 후속.

## DoD
- cloudfront.net 주소로 앱 라이브(정적/SSR/API 200), 소셜로그인·업로드·어드민 end-to-end 통과.
- `terraform plan = No changes`(코드=실제 일치). 결정 로그 최신화.
