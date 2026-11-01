# 다음 세션 핸드오프 — AWS 이전 Phase 2 이어하기

> 이 파일만 읽으면 다음 세션에서 바로 이어갈 수 있다. 최종 갱신: 2026-11-01

## 0. 세션 시작하는 법 (복붙용 킥오프 프롬프트)

새 세션 열고 이거 그대로 붙여넣기:

```
art-poke AWS 이전 Phase 2 이어서 한다. docs/superpowers/NEXT-SESSION-phase2.md 와
docs/superpowers/specs/2026-11-01-aws-phase2-design.md 읽고,
서브 C(인증 이전)부터 시작하자. AWS는 반드시 --profile artpoke (계정 138681986450, 회사 gr-readonly 금지).
먼저 /gstack 으로 brainstorming→writing-plans 거쳐 진행.
```

시작 시 Claude가 확인할 것:
- `aws sts get-caller-identity --profile artpoke` → Account `138681986450` 인지 (아니면 중단)
- 작업 레포: `~/orca/projects/art-poke/pokeca` (인프라 worktree 아님). 브랜치 `feat/frontend-wire-migrate`

---

## 1. 지금까지 완료 (Phase 1 + Phase 2 서브 B)

- ✅ **Phase 1**: VPC·RDS(도쿄)·S3·ECR·Secrets·IAM·healthcheck Lambda. `DB OK` 검증(Lambda→RDS).
- ✅ **Cognito 제거** (Auth.js로 가기로 함).
- ✅ **서브 B (DB 스키마)**: RDS에 25개 테이블 적용 완료.
  - `infra/db/00_authjs.sql` (Auth.js 테이블, uuid), `infra/db/01_app.sql` (앱 스키마 변환본)
  - 적용 도구: **migration Lambda** `infra/lambda-migrate/` — `aws lambda invoke --function-name pokeca-migrate --profile artpoke --region ap-northeast-1 /tmp/o.json`
- 전부 커밋됨, `terraform plan = No changes`.

## 2. 확정된 결정 (재논의 금지)

- 리전 **도쿄(ap-northeast-1)**, 상태버킷만 서울. 프로파일 **artpoke**.
- 앱 실행: **OpenNext + Lambda + CloudFront**
- 인증: **Auth.js(NextAuth)** — 카카오·구글·어드민(Credentials/bcrypt), 유저 **RDS**(Cognito 안 씀)
- 인가: **앱 레이어 if문 유지**(현 구조)
- 스토리지: **S3 + CloudFront(OAC)**
- 커넥션: Lambda 동시성 상한(초기), 압박 시 RDS Proxy
- NAT: **NAT 인스턴스(t4g.nano ~월3천원)** — NAT Gateway(4만원) 말고. (서브 A에서 필요: OAuth 토큰 교환이 인터넷으로 나가야 함)
- 전환: 빅뱅 컷오버 후 Vercel·Supabase 해지

## 3. 남은 작업 (순서대로)

### 서브 C — 인증 이전 (🔴 최대, 다음 세션 1순위)
Auth.js v5 도입. 대상 파일:
- `lib/supabase/auth.ts`, `lib/admin.ts`, `lib/artists.ts`(currentSocialUser), `lib/members.ts`
- `app/artist/actions.ts`(socialLogin/signInWithOAuth), `app/artist/callback/route.ts`, `app/artist/login/page.tsx`
- `app/admin/actions.ts`(signInWithPassword→Credentials+bcrypt), `app/admin/login/*`
- `components/auth-menu.tsx`
할 일:
1. `@auth/core` + next-auth v5 설치, `auth.ts` 설정(Kakao, Google, Credentials 공급자)
2. RDS 어댑터 연결(`@auth/pg-adapter` 또는 Drizzle) — users/accounts/sessions는 이미 RDS에 있음(00_authjs.sql)
3. `currentSocialUser()`·`requireAdmin()` 등을 Auth.js 세션 기반으로 재작성
4. 어드민 비번: bcrypt 해시 users.password_hash에 저장, Credentials authorize 검증
5. **카카오/구글 개발자 콘솔**: 콜백 URL을 `/api/auth/callback/{kakao,google}`로 추가(로컬+프로드)
6. env: `AUTH_SECRET`, `KAKAO_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `DATABASE_URL`
주의: 기존 `db()`(service_role 키)로 하던 데이터 접근은 RDS 직결(`DATABASE_URL`)로 바꿔야 함 — 이것도 서브 C/D에 걸침.

### 서브 D — 스토리지 이전 (🟡)
- 업로드: 서버에서 S3 presigned PUT 발급 → 클라 직접 업로드. 현 Supabase Storage 사용처 교체.
- 서빙: S3 비공개 + CloudFront(OAC). 작품 이미지 URL을 CloudFront 도메인으로.
- 버킷은 이미 있음: `pokeca-uploads-138681986450`

### 데이터 이전 (🟢)
- 데이터 거의 없음. `npm run demo`(seed 스크립트)를 RDS 대상으로 돌리거나, Supabase에서 `pg_dump --schema=public --data-only` → migration Lambda/psql로 적재.

### 서브 A — 앱 배포 (🔴)
- OpenNext 빌드 → Lambda(server)+S3(static)+CloudFront. (SST 또는 OpenNext CLI + Terraform)
- Lambda VPC 연결(RDS) + **NAT 인스턴스**(인터넷=카카오/구글 토큰).
- 도메인: **ACM 인증서는 us-east-1**(CloudFront 요건), CloudFront 대체도메인 + DNS 레코드.
- env/시크릿 주입.

### 서브 E — 컷오버 (🟢)
- 스모크(소셜로그인·업로드·어드민·주요플로우) → DNS를 CloudFront로 → Vercel·Supabase 해지.

## 4. 미해결/주의 (구현 전 결정 필요한 것)

- **공개 Function URL 403**: 신규계정 제한. 서브 A에서 CloudFront 세우면 자연 우회(해결 불필요).
- **NAT 필요**: VPC Lambda가 카카오/구글(인터넷) 호출하려면 NAT 인스턴스. 서브 A 착수 전 Terraform에 추가.
- **ACM us-east-1**: CloudFront용 인증서는 버지니아에 발급(리소스는 도쿄라도).
- **RLS on**: RDS는 마스터 유저로 접속하면 RLS 우회됨(현재 OK). 앱이 별도 DB 유저로 접속하게 바꾸면 RLS 정책 재검토.

## 5. 자주 쓰는 명령

```bash
# 항상 프로파일 + 계정 확인 먼저
aws sts get-caller-identity --profile artpoke   # Account=138681986450 여야 함

cd ~/orca/projects/art-poke/pokeca/infra
export AWS_PROFILE=artpoke
terraform plan            # 코드=실제 일치 확인(No changes 기대)

# 스키마 다시 적용(변경 시): db/*.sql 수정 → lambda-migrate/sql 갱신 빌드 → apply → invoke
cp db/*.sql lambda-migrate/sql/ && terraform apply
aws lambda invoke --function-name pokeca-migrate --profile artpoke --region ap-northeast-1 /tmp/o.json && cat /tmp/o.json

# DB 연결 테스트
aws lambda invoke --function-name pokeca-healthcheck --profile artpoke --region ap-northeast-1 /tmp/o.json && cat /tmp/o.json  # "DB OK"

# 비용 걱정되면 전체 내리기(스키마는 db/*.sql로 재생성 가능)
terraform destroy
```

## 6. 레포/문서 지도

- 인프라 코드: `infra/` (Terraform) · DB 스키마: `infra/db/`
- 설계: `docs/superpowers/specs/2026-10-31-aws-infra-phase1-design.md`, `.../2026-11-01-aws-phase2-design.md`
- 플랜: `docs/superpowers/plans/2026-10-31-aws-infra-phase1.md` (App Runner 기준—Lambda로 갱신 필요)
- 이슈·결정 기록: `docs/superpowers/2026-11-01-aws-infra-journey.md`
- 메모리(개인): `~/.claude/.../memory/art-poke-aws-migration.md`, `art-poke-aws-account-separation.md`
