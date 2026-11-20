# pokeca — 확장 아트 아카이브

카드 번호로 포켓몬 카드 확장 아트 도안을 찾는 비영리 아카이브. Next.js 16 + **AWS 네이티브(RDS·Lambda·CloudFront, Supabase 아님)**.

- 제품/설계: `docs/designs/extended-art-archive-mvp.md`, 인수인계: `docs/HANDOFF.md`
- Next.js 16 규칙: `AGENTS.md` (코드 작성 전 `node_modules/next/dist/docs/` 확인)

## 🚀 배포 / 상용 (매번 묻지 말고 여기부터 볼 것)

- **프로덕션 LIVE: https://artpokeca.com** (= CloudFront `d3mfru6qnveki4.cloudfront.net`).
- **AWS: 계정 `138681986450`, 항상 `AWS_PROFILE=artpoke`** (회사 계정 금지). 리전 `ap-northeast-1`(도쿄), ACM만 us-east-1, TF 상태버킷 `pokeca-tfstate-138681986450`(서울, key `phase1/terraform.tfstate`).
- **아키텍처**: CloudFront → API Gateway(HTTP API) → Lambda(OpenNext server/image), 정적=S3(OAC), DB=RDS(private·SSL), 아웃바운드=NAT 인스턴스(fck-nat).
- **앱 배포(코드 변경 시)**: `main` 푸시 시 GitHub Actions에서 자동 배포(OIDC 초기 설정은 `infra/README.md`). 로컬 수동 배포는 `AWS_PROFILE=artpoke bash scripts/deploy.sh`
  (OpenNext build → assets S3 sync → GitHub Actions는 앱 Lambda 코드 갱신, 로컬은 `terraform apply` → CloudFront invalidation).
- **운영 DB 마이그레이션**(RDS가 private이라 직접접속 불가 → migrate Lambda):
  ```bash
  cd infra && rm -rf lambda-migrate/sql && cp -R db/. lambda-migrate/sql/
  AWS_PROFILE=artpoke terraform apply -target=aws_lambda_function.migrate -auto-approve
  AWS_PROFILE=artpoke aws lambda invoke --function-name pokeca-migrate --region ap-northeast-1 /tmp/o.json && cat /tmp/o.json
  ```
  스키마·시드 둘 다 `infra/db/migrations/*.sql`(새 데이터는 **새 파일명**이어야 적용됨). 로컬은 `node --import tsx scripts/db-migrate.mts`(node20에서 `npm run db:migrate`/`demo`는 `.mts` 때문에 깨짐 → 반드시 `--import tsx`).
- **git push 전**: `gh auth switch --user clyde-yoonjae` (활성계정 `leeyunjae7`면 403). origin = `art-poke/pokeca`.
- **상세·함정**: `docs/superpowers/2026-11-05-subA-gotchas.md`, `docs/superpowers/NEXT-SESSION-phase2.md`, `infra/README.md`. 데이터 추가(SNKRDUNK 등): `.claude/skills/snkrdunk-catalog/SKILL.md`.
- **비용**: 월 ~$5 (RDS 상시 + NAT). 예산 알람 $20.

## 디자인시스템 (진행 중)

몬스터볼 테마(레드 #EE1515 · 화이트 · 블랙). **Tailwind v4 + shadcn 스타일** 컴포넌트.
- 토큰: `app/globals.css`(@theme) · 유틸: `lib/utils.ts`(cn) · 컴포넌트: `components/ui/`
- 카탈로그: Storybook (`npm run storybook`, :6006)
- 리서치/스펙: `docs/design-research/SYNTHESIS.md`
- 레거시 CSS Modules 화면은 점진적으로 Tailwind로 이관 중.

## 프론트엔드 아키텍처 (DDD 수직 슬라이스)

**단일 풀스택 Next(모놀리식).** 별도 백엔드 없음 — 같은 Next 안의 `lib/*`(서버 로직)와
기존 `app/api/*` route handler가 곧 서버다. 그 위에 react-query를 얹어 캐싱·에러 일관성을 준다.

**Canonical reference = `domains/artwork/`. 새 도메인은 이걸 복사해서 이름만 바꾼다.**

### 도메인 폴더 구조
```
domains/{도메인}/
├── api/
│   ├── queries.ts     # Query Key Factory (계층형)
│   ├── types.ts       # 클라 타입 (lib 타입 재사용 + 뷰 확장)
│   ├── endpoints.ts   # /api/* route 경로 상수 (쓰기용)
│   └── actions.ts     # "use server": 읽기 — lib/* 직접 호출(무홉)
├── hooks.ts           # react-query 훅. 커지면 hooks/{api,features,ui}로 분리
├── components/        # 표현/상호작용. hooks만 호출
└── {도메인}-*-page.tsx # 서버컴포넌트: prefetch(lib)→assert→dehydrate→SafeHydrationBoundary
```

### 데이터 경로
- **읽기**: 서버컴포넌트/서버액션 → `lib/*` 함수 직접 호출(별도 HTTP 홉 없음) → PostgreSQL(운영은 RDS).
- **쓰기**: 클라 훅 → `lib/api/client`의 `apiFetch('/api/...')` → 기존 route handler → `lib/*`.

### 의존 방향 (한 방향 아래로만)
```
*-page.tsx → api(actions/queries)
components → hooks → api(actions/queries) + lib/api/client
```

### 규칙 (eslint로 일부 강제)
- 쓰기는 **`lib/api/client`의 `apiFetch`** 로 `/api/*` 호출 (컴포넌트 raw fetch 금지).
- 읽기 서버액션은 실패 시 throw(쿼리가 처리). 쓰기는 `apiFetch`가 `ApiError{code,status}`를 throw.
- 에러 문구는 **`lib/api/error-codes`** 에서 code→문구 번역. 컴포넌트에 하드코딩 금지.
- 토스트는 **`lib/toast/gr-toast`** 로만 (sonner `toast` 직접 import 금지).
- 컴포넌트는 `api/actions`·`api/queries` 직접 import 금지 — **hooks 경유**.
- mutation은 낙관적 업데이트 + 롤백. 무효화는 쿼리키 트리로.
- **화면은 어떤 경우에도 멈추지 않는다**: `throwOnError:false`(인라인 에러 UI) + 서버컴포넌트는
  throw 대신 `assertPrefetchState`로 폴백.

### 공통 인프라 (`lib/`)
`api/client`(apiFetch, `/api/*` 호출) · `api/errors`(ApiError) · `api/error-codes`(code→문구 SSOT) ·
`query/query-client`(전역 설정)·`query/prefetch`·`query/safe-hydration-boundary` ·
`toast/gr-toast` · `case/camelize`.

> 분리(별도 백엔드)는 네이티브 앱/독립 확장 같은 트리거가 생기면 그때. 레이어 경계가 깔끔해
> `actions.ts`를 HTTP 호출로 바꾸는 수준의 리팩터링이면 된다.

## gstack

플래닝·디자인·리뷰는 gstack 스킬을 쓴다: `/office-hours`(제품 재구성), `/spec`(스펙화),
`/plan-eng-review`·`/plan-design-review`·`/autoplan`(계획 검토), `/design-shotgun`(목업),
`/review`·`/qa`·`/ship`(구현·검증·출하).
웹 브라우징은 이 환경의 `ego-browser` 스킬을 우선 사용한다.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. Route only to skills in the session's available-skills list; answer directly for quick questions or small scoped edits.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate, unless one read-only check confirms the cause and a narrow fix (then fix it and run the focused test)
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
