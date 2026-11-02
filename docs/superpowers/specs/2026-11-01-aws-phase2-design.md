# AWS 이전 Phase 2 — 설계 (앱 전체 이전)

- 작성일: 2026-11-01
- 전제: Phase 1 완료(인프라 골대, Lambda→RDS 연결 증명). 본 문서는 **실제 앱 이전**.
- 목표: art-poke(pokeca)를 Vercel+Supabase에서 **완전히** AWS로 옮기고 Vercel·Supabase 해지.
- 관련: Phase 1 설계 `2026-10-31-aws-infra-phase1-design.md`, 여정 기록 `../2026-11-01-aws-infra-journey.md`

---

## 1. 확정 결정 (Phase 2)

| # | 영역 | 결정 | 이유 |
|---|---|---|---|
| P2-1 | 앱 실행 | **OpenNext + Lambda + CloudFront** | Phase 1 Lambda와 일관, 서버리스 유휴 0. CloudFront가 공개입구 자동 → 신규계정 공개URL 제한 우회 + 도메인 부착 지점 |
| P2-2 | 인증 | **Auth.js(NextAuth)** ← Cognito 폐기 | 앱이 카카오+구글 소셜 사용. Auth.js는 카카오·구글 1급 내장, 유저를 RDS에 직접 저장(FK 문제 해결, 미러 불필요), $0, Next 네이티브 |
| P2-3 | 인가 | **앱 레이어 권한(if문) 유지** | 현 구조 그대로. "누구야?"만 Supabase→Auth.js로 교체 |
| P2-4 | 어드민 로그인 | **Auth.js Credentials**(bcrypt 해싱) | 현 `signInWithPassword` 대체 |
| P2-5 | DB | **RDS Postgres**(Phase 1에 이미 있음) | `supabase/migrations/` 이식, `auth.users` FK → Auth.js `users` 테이블 |
| P2-6 | 데이터 이전 | **pg_dump → pg_restore (빅뱅)** | 데이터 거의 없음. 무중단 불필요 |
| P2-7 | 스토리지 | **S3**(Phase 1 버킷) | Supabase Storage 업로드/서빙 코드 교체. 서빙은 CloudFront 경유 권장 |
| P2-8 | 공개입구 | **CloudFront**(OpenNext 자동) | 도메인+ACM(HTTPS) 부착. API Gateway 불필요 |
| P2-9 | RDS 커넥션 | **Lambda 동시성 상한 캡** (RDS Proxy 보류) | t4g.micro ~80커넥션 보호. 트래픽↑ 시 RDS Proxy(+월 ~2만) 추가 |
| P2-10 | 시크릿 | **Lambda env 주입**(DB·OAuth) | 간단. 후반 VPC 엔드포인트로 Secrets 런타임조회 승격 옵션 |
| P2-11 | 전환 | **빅뱅 컷오버** 후 Vercel·Supabase 해지 | 런칭 전·소규모라 안전 |

### Phase 1 인프라에서 바뀌는 것
- **제거**: `cognito.tf`(빈 풀, Auth.js로 대체)
- **추가**: CloudFront + OpenNext 산출물(Lambda@Edge/함수, S3 assets), ACM 인증서, Route53(또는 외부 DNS) 레코드, (후반) RDS Proxy·VPC 엔드포인트
- **유지**: VPC, RDS, S3(업로드), ECR(불요 시 제거 가능), Secrets Manager, 상태 백엔드

---

## 2. 서브프로젝트 분해 & 순서

```
B. DB 이전 ──┐
             ├─▶ C. 인증 이전(Auth.js) ──┐
D. 스토리지 ──┘                           ├─▶ A. 앱 배포(OpenNext+CF+도메인) ──▶ E. 컷오버
                                          │
         (A의 스켈레톤 배포는 B/C/D와 병행 가능)
```

| 서브 | 범위 | 난이도 | 선행 |
|---|---|---|---|
| **B. DB 이전** | migrations 이식(`auth.users`→`users` FK 수정), pg_dump/restore, 로컬 검증 | 🟡 | - |
| **C. 인증 이전** | Auth.js 셋업(카카오·구글·Credentials), RDS 어댑터 users/accounts/sessions 테이블, `lib/supabase/auth.ts`·`artists.ts`·`admin.ts`·`members.ts`·`app/artist/*`·`app/admin/*` 재작성, 카카오/구글 콘솔 콜백 URL 교체 | 🔴 | B |
| **D. 스토리지 이전** | `lib/*`의 Supabase Storage 업로드/서빙 → S3(presigned PUT + CloudFront 서빙) | 🟡 | - |
| **A. 앱 배포** | OpenNext 빌드·배포(Lambda+CloudFront), env(시크릿) 주입, VPC 연결(RDS), 도메인+ACM | 🔴 | C,D(완성본) / 스켈레톤은 병행 |
| **E. 컷오버** | DNS 전환, 스모크 테스트, Vercel·Supabase 해지, (옵션)RDS Proxy | 🟢 | A,B,C,D |

**권장 착수 순서:** B(DB) → D(스토리지, C와 병행 가능) → C(인증) → A(배포) → E(컷오버). B가 C의 선행(인증 테이블/FK가 RDS에 있어야 함).

---

## 3. 서브별 핵심 포인트

### B. DB 이전
- `supabase/migrations/*.sql` 재사용하되 `auth.users(id)` 참조 FK를 Auth.js `users(id)`로 교체.
- Auth.js 어댑터 테이블(users, accounts, sessions, verification_token)을 스키마에 추가(어댑터가 생성 or 수동 DDL).
- 데이터: `pg_dump`(Supabase) → `pg_restore`(RDS). seed 스크립트(`npm run demo`)도 RDS 대상으로 동작 확인.

### C. 인증 이전 (가장 큼)
- Auth.js v5 설치, 공급자: Kakao, Google, Credentials(어드민).
- RDS 어댑터(Drizzle/Prisma 또는 `@auth/pg-adapter`)로 세션·유저 저장.
- 교체 대상: `authClient()`(signInWithOAuth/exchangeCodeForSession/getUser/signInWithPassword/signOut), `currentSocialUser()`(provider 판별 → Auth.js session), `requireAdmin`/`currentAdmin`(세션 기반).
- 카카오/구글 개발자 콘솔: 콜백 URL을 Auth.js 경로(`/api/auth/callback/kakao` 등)로 추가/교체.
- 어드민 비번: bcrypt 해시를 RDS에 저장, Credentials authorize에서 검증.

### D. 스토리지 이전
- 업로드: 서버에서 S3 presigned PUT 발급 → 클라 직접 업로드(또는 서버 경유). 현 Supabase Storage 사용처 교체.
- 서빙: S3 비공개 + CloudFront(OAC)로 서빙. 작품 이미지 URL을 CloudFront 도메인으로.

### A. 앱 배포
- OpenNext로 Next.js 빌드 → Lambda(server) + S3(정적) + CloudFront 배포(Terraform 또는 OpenNext/SST).
- Lambda는 VPC 연결(RDS 접근) + env로 시크릿 주입(DB_URL, AUTH_SECRET, KAKAO/GOOGLE client id·secret).
- 도메인: ACM 인증서(us-east-1, CloudFront 요건) + CloudFront 대체 도메인 + DNS.

### E. 컷오버
- 스모크: 소셜 로그인·업로드·어드민·주요 플로우 수동 테스트.
- DNS를 CloudFront로 전환 → 모니터링 → Vercel·Supabase 해지.

---

## 4. 리스크 / 함정

1. **OpenNext + VPC Lambda 콜드스타트**: 로그인/SSR 첫 요청 지연. keep-warm 핑 or 주요 라우트 대비.
2. **서버리스 Postgres 커넥션 고갈**: Lambda 동시성 상한 필수. 넘치면 RDS Proxy.
3. **카카오 OAuth 콜백 URL**: 로컬/프로드 각각 등록. Auth.js 경로 규약 준수.
4. **ACM은 us-east-1**: CloudFront용 인증서는 버지니아 리전에 발급해야 함(리소스는 도쿄라도).
5. **VPC Lambda ↔ Secrets/외부 API**: NAT 없으면 외부(카카오/구글 토큰 엔드포인트) 호출 불가 → **NAT Gateway 또는 VPC 엔드포인트 필요**(OAuth 토큰 교환이 외부로 나가야 함). 이게 Phase 2의 숨은 비용/복잡도 포인트(NAT ~월 4만원). 대안: 인증 처리 Lambda만 VPC 밖(RDS는 Data API/Proxy로)… 설계 시 확정 필요.
6. **데이터 정합성**: pg_dump 시 Supabase 전용 스키마(auth, storage) 제외하고 public만.

> ⚠️ #5(NAT)는 Phase 2에서 비용·구조에 큰 영향 → 구현 착수 전 별도 확정 필요(브레인스토밍 후속).

---

## 5. 성공 기준 (Phase 2 DoD)

- [ ] RDS에 전체 스키마 + 데이터 이전, 앱이 RDS로 동작
- [ ] 카카오·구글 로그인, 어드민 로그인이 Auth.js로 동작
- [ ] 업로드/이미지 서빙이 S3+CloudFront로 동작
- [ ] Next.js 앱이 Lambda+CloudFront로 배포, 커스텀 도메인+HTTPS
- [ ] 공개 도메인에서 전체 플로우 스모크 통과
- [ ] Vercel·Supabase 해지, 비용 모니터링
- [ ] 모든 인프라 Terraform 정본, `plan = No changes`

---

## 6. 범위 밖 / 나중
- RDS Proxy(커넥션 압박 시), VPC 엔드포인트(Secrets 런타임조회), 멀티프로젝트 platform/app 레이어 분리, 모니터링/알람(CloudWatch), CI/CD 파이프라인.
