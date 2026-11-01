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
- **읽기**: 서버컴포넌트/서버액션 → `lib/*` 함수 직접 호출(네트워크 홉 없음) → Supabase.
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
