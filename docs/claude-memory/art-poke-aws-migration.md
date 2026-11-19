---
name: art-poke-aws-migration
description: art-poke 상용 배포·인프라 (LIVE https://artpokeca.com). 배포법(AWS_PROFILE=artpoke bash scripts/deploy.sh)·운영DB 마이그레이션(migrate Lambda)·AWS 계정(138681986450)/리전(도쿄)/프로파일/상태버킷. "어디 떠있나·어떻게 배포하나·상용 URL" 질문의 정답.
metadata: 
  node_type: memory
  type: project
  originSessionId: d360bfb1-232d-43e7-ac17-59614d64a82e
---

art-poke(pokeca)를 **완전 AWS 네이티브**로 이전 중 (2026-10-31 시작, 데이터 거의 없을 때라 적기).

**확정 스택:** Terraform(IaC) + **Lambda(서버리스)** + RDS Postgres t4g.micro(프리티어) + Cognito(인증) + S3 + Secrets Manager + Resend. **리전 도쿄(ap-northeast-1)**, 상태버킷만 서울. IaC 정본은 Terraform, MCP(aws-api)는 조회·검증 전용.

**⚠️ 중요 변경사항 (실배포 중 발견):**
- **App Runner 폐기** — 2026-04-30부터 AWS App Runner가 **신규 고객을 안 받음**(콘솔 공지 확인). 신규 계정은 서비스 생성 불가. 대체재는 ECS Express Mode지만 Terraform 지원 불확실 → **Lambda로 전환**.
- **App Runner는 서울 리전에도 없었음**(ap-northeast-2 미지원) → 그래서 도쿄(ap-northeast-1)로 이미 옮긴 상태였고, Lambda도 도쿄 유지.
- Lambda 선택 이유: ALB 불필요(입구 내장), 유휴 0 수렴(월 ~1만원), 멀티 사이드프로젝트 추가 거의 공짜. 대가는 콜드스타트 1~3초(5분 핑으로 완화 가능).

**인증/권한 핵심 (코드만 보면 오해하기 쉬움):** 이 앱은 **이미 앱 레이어 권한 방식**이다. 데이터 접근은 `lib/supabase/server.ts`의 `db()` = secret 키(RLS 우회)로 서버에서 수행, 권한은 `lib/admin.ts` 등 if문(`admins` 허용목록)으로 체크. RLS는 `enable row level security`만 켜고 `create policy` **0개**(장식). → 이전 시 "누구야?"만 Cognito로 교체, 권한 if문 재사용, RLS 안 씀. FK가 `auth.users(id)`(Supabase 전용) 참조 → 자체 `users` 테이블 신설 후 Cognito sub 저장 필요.

**레포 배치:** `pokeca/infra/`에 Terraform (앱과 같은 레포).

**진행 단계:** Phase 1 = 인프라 골대(Terraform로 리소스 세우고 헬스체크 컨테이너로 App Runner→RDS 배선 증명). Phase 2 = Cognito 인증교체+users테이블+RDS마이그이식+S3업로드전환+실컨테이너화.

**Phase 1 완료 (2026-11-01): ✅ DB OK 달성.** `pokeca/infra/`에 Terraform 전체 배포됨(도쿄). 25개 리소스 live, `terraform plan = No changes`(코드=실제 일치). **Lambda→VPC→RDS 연결 증명**을 `aws lambda invoke --function-name pokeca-healthcheck` → `body:"DB OK"`로 확인. 프로파일 `artpoke`(계정 138681986450), 상태버킷 `pokeca-tfstate-138681986450`(서울).

**알려진 미해결(Phase 2):** 공개 Lambda Function URL이 **신규 계정 제한으로 403 Forbidden**(리소스 정책은 올바름, 조직 아님). App Runner 신규계정 게이트와 같은 패턴. → Phase 2에서 API Gateway/CloudFront로 감싸거나 계정 제한 해제. 연결 증명 자체는 invoke로 충분.

**Phase 2 인증 결정 변경 (2026-11-01): Cognito → Auth.js(NextAuth).** 이유: 앱이 **카카오+구글 소셜 로그인**을 실제 사용(`app/artist/actions.ts` signInWithOAuth, `lib/artists.ts` currentSocialUser, 어드민은 `signInWithPassword`). Cognito는 카카오 내장 IdP가 없어 OIDC 수동 등록 필요(함정↑) + 유저 미러 테이블 필요 + 락인. Auth.js는 카카오·구글 1급 내장, 유저를 RDS에 직접 저장(FK auth.users 문제 자연 해결, 미러 불필요), $0, Next 네이티브. 앱 레이어 권한(if문)은 그대로 유지. → **Phase 1의 cognito.tf 제거 예정(빈 풀이라 공짜)**. 어드민 비번은 Auth.js Credentials 공급자(bcrypt 해싱 직접).

**Phase 2 진행 (2026-11-01):**
- ✅ **Cognito 제거** 완료(apply, Auth.js로 가므로).
- ✅ **서브 B (DB 스키마 이전) 완료**: `infra/db/00_authjs.sql`(Auth.js 테이블, uuid id) + `infra/db/01_app.sql`(supabase/migrations 자동변환: auth.users→users, storage.*·롤 grant/revoke 제거, extensions→public). 로컬 Postgres16 검증 후 **migration Lambda(`infra/lambda-migrate/`, invoke 전용, VPC 내부)로 실제 RDS에 적용 → 25개 테이블 생성 확인**. migration Lambda는 재사용 가능(Phase 2 이후 마이그레이션도 이걸로).
- 확정: 앱=OpenNext+Lambda+CloudFront, 인증=Auth.js, NAT는 **NAT 인스턴스(~월3천원)** 권장(Gateway 4만원 대신)—서브 A 때 필요.
- ✅ **서브 C 설계+구현플랜 완료 (2026-11-01, brainstorming→writing-plans, 둘 다 리뷰 승인)**: `specs/2026-11-01-aws-phase2-subC-auth-design.md` + `plans/2026-11-01-aws-phase2-subC-auth.md` (브랜치 `feat/aws-phase2-subC-auth`는 플랜 Task 0.0에서 생성 예정, 베이스 `feat/frontend-wire-migrate`). **서브 C = 인증(Auth.js) + 데이터계층(db()→Drizzle) 동시 전환.** 핵심 결정: Auth.js v5(`next-auth@5.0.0-beta.32`, Next16/React19 호환확인됨; Kakao/Google/Credentials, **JWT 세션**=Credentials 제약), **Drizzle ORM + `@auth/drizzle-adapter` + `pg`**, **split-config**(엣지 `auth.config.ts` + 노드 `auth.ts`), 로컬 **Docker Postgres 5432**(포트 빔) + `infra/db/*.sql` + `npm run demo`, 유저 **새로 시작**(이전 없음), 어드민 bcrypt. 단계 C0(토대)→C1(인증코어, 로컬 로그인 end-to-end)→C2(데이터 134곳)→C3(정리).
- **⚠️ db() 134곳 = 3종류**(실행 전 반드시 분류): `.from()` PostgREST(대부분, Drizzle 쿼리) + **`.rpc()` 12곳**(저장프로시저→`db.execute(sql...)`) + **`.storage.*` 13곳**(storage.ts 11/cleanup.ts 2 → **서브 D 소관**, 서브C에선 `lib/storage-client.ts`로 격리만, `@supabase/supabase-js`·`SUPABASE_*` env는 서브D까지 유지). 서브C에서 제거하는 건 `@supabase/ssr`+`lib/supabase/{auth,server}.ts`뿐. 스토리지 의존 테스트는 서브D까지 blocked.
- **카카오/구글 콘솔 콜백**(`http://localhost:3000/api/auth/callback/{kakao,google}`)은 C1에서 필요 → 사용자에게 알리고 **ego-lite로 직접 등록**(어드민 로그인은 콘솔 불필요하므로 먼저 검증).
- ✅ **서브 C 구현 완료 (2026-11-02, 야간 자율 진행)**: 브랜치 `feat/aws-phase2-subC-auth`, **PR #1** (https://github.com/art-poke/pokeca/pull/1, base `feat/frontend-wire-migrate`). `db()` 134곳 전부 Drizzle 전환(.rpc는 db.execute(sql)로 plpgsql 그대로), Auth.js v5(split-config, JWT, DrizzleAdapter, Credentials/bcrypt), `lib/supabase/{auth,server}.ts`·`@supabase/ssr` 제거. **typecheck/test(135 pass,38 skip)/build 전부 녹색.** 로컬=Docker PG 5432(`docker-compose.yml`). ⚠️테스트/시드 **Node 22 필요**. 어드민 로그인 curl로 end-to-end 검증.
- **서브 C에서 서브 D로 이월**: ①스토리지 `db().storage.*`→`lib/storage-client.ts`(얇은 Supabase storage 래퍼)로 격리, `@supabase/supabase-js`·`NEXT_PUBLIC_SUPABASE_URL`·`SUPABASE_SECRET_KEY` 아직 남김(서브 D=S3에서 제거). ②스토리지 결합 통합테스트 4개 `describe.skip`(blocked until sub D), `tests/helpers/fixtures.ts` 미이전. ③시드 스크립트(`scripts/*.mts`) 5432 미이전(self-seeding 테스트로 대체). 
- **서브 C 머지 전 사용자 액션 대기**: 소셜 로그인 브라우저 검증 = 카카오/구글 콘솔 콜백 등록 + `.env.local`에 `AUTH_KAKAO_*`/`AUTH_GOOGLE_*`(ego-lite). 다음 세션 1순위=서브 D.
- **서브 D 착수 (2026-11-02)**: 브랜치 `feat/aws-phase2-subD-storage`(sub C 위에 스택). 사전 결정 기록 `docs/superpowers/2026-11-02-subD-storage-decisions.md`. **확정**: 업로드=**클라이언트 직접 presigned**(서버 프록시 X — Lambda 6MB 바디 한계 + 작품 100MB, 게다가 현 코드가 이미 createSignedUploadUrl/uploadToSignedUrl 클라-직접). 흐름 ①서버가 presigned URL만 발급(인증 필수)→②브라우저 fetch로 S3 직접 PUT(서버액션 불가)→③클라가 key 문자열만 서버로 보내 promote(HeadObject 검증+pending→final). 보안: 버킷 비공개+CloudFront(OAC)/presigned GET, 짧은 만료, key는 서버가 결정, pending→promote 격리검증, CORS 도메인 한정, lifecycle GC. **열린 결정(브레인스토밍)**: PUT+promote검증 vs POST+content-length-range / 기존 객체 이전여부(런칭전이라 미이전 유력) / CloudFront 시점 / 서빙방식. 교체 지점=`lib/storage-client.ts` 한 곳.
- ✅ **서브 D 완료 (2026-11-02, 야간 자율, 브랜치 `feat/aws-phase2-subD-storage`, PR #2 base=sub C PR#1).** 결정: 업로드=presigned PUT+promote검증, 서빙=presigned GET(CloudFront는 서브 A), 기존객체 미이전. `lib/storage-client.ts`를 `@aws-sdk/client-s3`+presigner로 재작성(uploadUrl/viewUrl/head/getRange/getObject/putObject/copy/remove/list/listWithMeta, 논리버킷→실버킷 매핑). storage.ts promote=HeadObject 크기강제+Range 매직바이트+copy/delete. **infra/s3.tf: consent-evidence 버킷+두 버킷 CORS·lifecycle apply 완료**(terraform plan No changes). `@supabase/*` 완전 제거. 검증: typecheck/build/`AWS_PROFILE=artpoke npm test`(178 pass) 녹색. **viewUrl 한글 파일명은 RFC5987 필수**(S3는 비ASCII content-disposition에 400). **서브 A가 추가**: CloudFront+OAC 서빙, CORS 프로드 origin, app Lambda S3 IAM. **잔여 debt**: 데모 시드 scripts/*.mts 아직 Supabase+node20 .mts 깨짐 → tsconfig 제외, `npm run demo` 복구 필요(pg+S3+tsx 포팅).
- **⚠️ git push 주의**: origin=art-poke/pokeca(HTTPS). gh 활성 계정이 **leeyunjae7로 드리프트**하면 push 403(권한 없음). push 전 `gh auth switch --user clyde-yoonjae` 확인(`gh api user -q .login`). SSH 키도 leeyunjae7에 묶임. 한 셸에서 `unset GH_TOKEN GITHUB_TOKEN; gh auth switch --user clyde-yoonjae; <gh 명령>` 패턴으로 해결.
- **PR 상태 (2026-11-02)**: 서브 C(#1)·서브 D(#2) **main에 머지 완료**. main tip=`a7280be`. (소셜 로그인 브라우저 검증은 미완 상태로 머지 — 콘솔 세팅 후 검증 필요.)
- **배포 담당자 IAM (2026-11-02 발급)**: 별명 **ddol9** → IAM 유저 `ddol9`(arn:...:user/ddol9), **PowerUserAccess+IAMFullAccess**, 콘솔 로그인(임시비번·최초변경강제)+액세스키 발급. **계정 별칭 `artpoke`** 설정함 → 로그인 URL `https://artpoke.signin.aws.amazon.com/console`(Account 칸에 `artpoke` 또는 138681986450). ddol9는 `aws configure --profile artpoke`로 자기 키 넣고 LLM/terraform 사용. **예산 알람** 월$20(80%실제·100%예측→lyj@green-ribbon.co.kr) 설정됨. 작업 끝나면 키/유저 회수. zsh는 `$VAR` 공백분리 안 함 → aws 명령에 `--profile artpoke` 인라인으로.

- ✅ **서브 A (앱 배포) 완료 (2026-11-05, 브랜치 `feat/aws-phase2-subA-deploy`, main 머지).** **프로덕션 LIVE: https://d3mfru6qnveki4.cloudfront.net** — 카카오·구글 로그인 end-to-end 작동. 아키텍처: CloudFront(기본도메인) → **API Gateway HTTP API** → Lambda(OpenNext server/image), 정적=S3(OAC), DB=RDS(SSL), 아웃바운드=NAT 인스턴스(fck-nat t4g.nano). OpenNext 4.1.15 + Next 16.4.5. 배포=`scripts/deploy.sh`(반드시 AWS_PROFILE=artpoke). 프로드 RDS에 유저=작가 마이그레이션 적용됨.
  - **결정/삽질 전부 기록**: `docs/superpowers/2026-11-04-subA-deploy-decisions.md`(ADR-A1~A16) + **`docs/superpowers/2026-11-05-subA-gotchas.md`(막혔던 것 전부 — 다음에 반복 금지용)**.
  - **핵심 교훈**: ①**Function URL 쓰지 말고 처음부터 API Gateway**(신규계정이 public Function URL 403 차단 + OAC는 POST body 미서명 403). ②OpenNext는 sharp를 server fn에 `install`로 넣어야(SSR 500), 번들은 `zip -ry`(archive_file 심볼릭 실패), dummy 캐시. ③RDS는 `sslmode=no-verify` 필수. ④x-forwarded-host CloudFront Function + AUTH_TRUST_HOST. ⑤**카카오 KOE006**: redirect URI를 콘솔 `앱→플랫폼키→REST API키 수정`의 **"카카오 로그인 리다이렉트 URI"** 섹션에(실수로 "비즈니스 인증" 섹션에 넣으면 저장돼 보여도 KOE006). 검증=authorize URL 직접 쳐서 KOE006 여부. ⑥OAuth 콘솔 ego 조작은 **실제 키보드 타이핑**(JS value 주입은 React 상태에 안 잡혀 저장 누락).
  - **⚠️ 알려진 미해결 버그**: **프로덕션 signout이 세션 안 지움**(`/api/auth/signout` 후에도 세션 유지, 로그인은 정상). 가설=청크 authjs 세션쿠키의 다중 Set-Cookie가 CloudFront/APIGW 거치며 일부만 전달. gotchas §7. 공용PC 로그아웃 안 됨 → 우선순위 중.
  - **서브 A 후속**: 커스텀 도메인(Route53+ACM us-east-1+alias+OAuth 프로드 URI), API Gateway 직접접근 하드닝(CloudFront 시크릿헤더), 어드민 프로드 시드, 작품이미지 CloudFront+OAC, 데모시드 Supabase→pg 포팅, **서브 E 컷오버**(Vercel/Supabase 해지).

- ✅ **커스텀 도메인 `artpokeca.com` 라이브 (2026-11-07~08).** Route53 신규 등록(호스팅존 `Z07615522FENCJUBQ8T70`, .com $16/년) → `infra/domain.tf`(ACM us-east-1 DNS검증 + apex A/AAAA alias) + `providers.tf`에 `aws.us_east_1` alias + `cloudfront.tf`에 `aliases`+ACM viewer_cert + `s3.tf` CORS에 프로드 도메인 추가. `terraform apply` 5add/3change/0destroy. 검증: `https://artpokeca.com` HTTP 200 + ACM 인증서 CN=artpokeca.com. 최신 main(85ffa8e) 재배포도 완료(`scripts/deploy.sh`). **OAuth 프로드 콜백 추가 완료**: 카카오(REST키 57bd70..., "카카오 로그인 리다이렉트 URI" 섹션에 `https://artpokeca.com/api/auth/callback/kakao`, KOE006 아님 검증) + 구글(클라이언트 `723320935162-g3n7s4p43...`="art-poke local", 프로젝트번호 723320935162 **authuser=1=본인 cool-splice 계정 소유**, 리디렉션 URI+JS원본에 artpokeca.com 추가, redirect_uri_mismatch 아님 검증). **AUTH_URL 안 건드림**(AUTH_TRUST_HOST=true + CloudFront x-forwarded-host가 자동 처리). ⚠️ 구글 콘솔 자동화는 project/authuser 라우팅이 cool-splice로 자꾸 리셋돼 실패 → 결국 사용자 수동 편집. 최종 확정은 브라우저 실제 로그인으로.
- **AWS 비용 현황(2026-11)**: 월 ~$5(≈₩7천), 주 비용=RDS 상시가동 + NAT 인스턴스. 예산 알람 $20. (한때 카드 만료로 ₩621 연체+도메인 결제 막힘 → 카드 갱신으로 해결.)

- ✅ **로그아웃 버그 수정 (2026-11-08).** 근본원인: `proxy.ts`의 Auth.js `auth()` 미들웨어가 `/api/auth` 포함 전 경로에 돌며 세션 쿠키를 refresh(재발급) → signout의 삭제 Set-Cookie를 덮어씀(gotchas §7 기존 가설=청크/CloudFront 전부 오진, 실측 반증). 수정: ①`proxy.ts` matcher에서 `/api/auth` 제외 ②로그아웃을 서버액션 signOut()→`next-auth/react` signOut()(엔드포인트 경유, `components/signout-button.tsx`) 3곳 교체, 버그난 `logout()` 서버액션 제거. artpokeca.com 실검증(쿠키 삭제·session null).
- ✅ **회원탈퇴 구현 (2026-11-08).** 설계: soft(deletedAt 마커)+PII 익명화+작품 유지+문구타이핑 확인. `artists.deleted_at` 추가(마이그 `20261108_120000_artist_deleted_at.sql`, 프로드 적용됨). `lib/artists.ts withdrawMyAccount`=artists 익명화(display_name='탈퇴한 작가', handle=null 등)+users PII null+accounts(OAuth) 언링크+아바타 S3 제거. handle=null이라 공개페이지/검색 자동 제외. UI=`components/withdraw-account.tsx`(/me 하단, dialog+타이핑확인→성공시 signOut). 재로그인=새 user(언링크). artpokeca.com 실검증(A≠B).

**Phase 2 남은 일:** 서브 E 컷오버(DNS는 이미 artpokeca.com, 이제 Vercel/Supabase 해지) + 서브 A 후속(API GW 하드닝, 어드민 프로드 시드, 작품이미지 CloudFront+OAC, 데모시드 pg 포팅). **⚠️ 로그아웃/회원탈퇴/도메인(domain.tf 등) 변경이 전부 라이브인데 git 미커밋** — 커밋+push 필요(push 전 `gh auth switch --user clyde-yoonjae`). 배포·도메인·로그아웃·회원탈퇴 완료(라이브).

**설계 문서:** `pokeca/docs/superpowers/specs/2026-10-31-aws-infra-phase1-design.md` (커밋됨). 사용자는 프론트 개발자, AWS 거의 처음 → 초보자 함정(상태버킷 부트스트랩, App Runner IAM 역할 2개, HTTP 헬스체크 경로, RDS 프리티어 조건) 설계에 반영됨.

관련: [[art-poke-github-fork]] [[art-poke-design-system]]
