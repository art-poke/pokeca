# pokeca — 확장 아트 아카이브

카드 번호로 포켓몬 카드 확장 아트 도안을 찾는 비영리 아카이브. Next.js 16 + Supabase.

- 제품/설계: `docs/designs/extended-art-archive-mvp.md`, 인수인계: `docs/HANDOFF.md`
- Next.js 16 규칙: `AGENTS.md` (코드 작성 전 `node_modules/next/dist/docs/` 확인)

## 디자인시스템 (진행 중)

몬스터볼 테마(레드 #EE1515 · 화이트 · 블랙). **Tailwind v4 + shadcn 스타일** 컴포넌트.
- 토큰: `app/globals.css`(@theme) · 유틸: `lib/utils.ts`(cn) · 컴포넌트: `components/ui/`
- 카탈로그: Storybook (`npm run storybook`, :6006)
- 리서치/스펙: `docs/design-research/SYNTHESIS.md`
- 레거시 CSS Modules 화면은 점진적으로 Tailwind로 이관 중.

## 프론트엔드 아키텍처 (DDD 수직 슬라이스)

데이터는 **별도 백엔드 API**에서 온다. Next는 BFF — 서버액션/미들웨어만 토큰(httpOnly 쿠키)을
읽어 `Authorization: Bearer`로 붙인다. 브라우저 JS는 토큰을 못 본다.

**Canonical reference = `domains/artwork/`. 새 도메인은 이걸 복사해서 이름만 바꾼다.**

### 도메인 폴더 구조
```
domains/{도메인}/
├── api/
│   ├── queries.ts     # Query Key Factory (계층형)
│   ├── types.ts       # Server*(wire) + Client(UI) 타입 분리
│   ├── endpoints.ts   # 엔드포인트 상수 (하드코딩 금지)
│   └── actions.ts     # "use server": serverApi 호출 + transform. 쓰기는 withErrorHandling
├── transform.ts       # Server→Client 변환 (순수함수)
├── hooks.ts           # react-query 훅. 커지면 hooks/{api,features,ui}로 분리
├── components/        # 표현/상호작용. hooks만 호출
└── {도메인}-*-page.tsx # 서버컴포넌트: prefetch→assert→dehydrate→SafeHydrationBoundary
```

### 의존 방향 (한 방향 아래로만)
```
*-page.tsx → api(actions/queries) + transform
components → hooks → api(actions/queries)
```

### 규칙 (eslint로 일부 강제)
- 서버 데이터는 **`lib/api/server-fetch`의 `serverApi`** 로만 (raw fetch/axios 금지).
- 읽기 액션 = throw(쿼리가 처리) · 쓰기 액션 = `withErrorHandling`(결과 객체 반환 → code별 분기).
- 에러 문구는 **`lib/api/error-codes`** 에서 번역. 컴포넌트에 하드코딩 금지.
- 토스트는 **`lib/toast/gr-toast`** 로만 (sonner 직접 import 금지).
- 컴포넌트는 `api/actions`·`api/queries` 직접 import 금지 — **hooks 경유**.
- mutation은 낙관적 업데이트 + 롤백. 무효화는 쿼리키 트리로.
- **화면은 어떤 경우에도 멈추지 않는다**: `throwOnError:false`(인라인 에러 UI) + 서버컴포넌트는
  throw 대신 `assertPrefetchState`로 폴백.

### 공통 인프라 (`lib/`)
`api/server-fetch`(서버 클라이언트) · `api/envelope`·`api/error-codes`(응답/에러 규격) ·
`server-action/with-error-handling` · `query/query-client`(전역 설정)·`query/prefetch`·
`query/safe-hydration-boundary` · `toast/gr-toast` · `case/camelize` · `auth/constants`.

## gstack

플래닝·디자인·리뷰는 gstack 스킬을 쓴다: `/office-hours`(제품 재구성), `/spec`(스펙화),
`/plan-eng-review`·`/plan-design-review`·`/autoplan`(계획 검토), `/design-shotgun`(목업),
`/review`·`/qa`·`/ship`(구현·검증·출하).
웹 브라우징은 이 환경의 `ego-browser` 스킬을 우선 사용한다.
