# artwork — Canonical Reference 도메인

**새 도메인을 만들 땐 이 폴더를 통째로 복사해서 이름만 바꾼다.** 레이어 규칙은 루트 `CLAUDE.md` 참조.

구조는 **단일 풀스택 Next(모놀리식)** 전제다. 데이터는 같은 Next 안의 `lib/*`(서버) 또는
기존 `app/api/*` route(서버)에서 온다. 별도 백엔드 없음.

## 파일별 역할

| 파일 | 역할 | 의존 |
|---|---|---|
| `api/queries.ts` | Query Key Factory | — |
| `api/types.ts` | 클라 타입 (lib 타입 재사용 + 뷰 확장) | `@/lib/*` 타입 |
| `api/actions.ts` | `"use server"` **읽기** 함수 (lib/* 직접 호출, 무홉) | `@/lib/*` |
| `hooks.ts` | react-query 훅 (`"use client"`). 읽기=서버액션, **쓰기=기존 API route 호출**(`apiFetch`) | actions, queries, `@/lib/api/client` |
| `components/*` | 표현/상호작용 | **hooks만** (actions/apiFetch 직접 X) |
| `artwork-*-page.tsx` | 서버컴포넌트 prefetch(lib) + hydrate | actions, queries, components |

## 데이터 경로 (모놀리식)

- **읽기**: 서버컴포넌트/서버액션 → `lib/*` **함수 직접 호출** → Supabase. (네트워크 홉 없음)
- **쓰기**: 클라 훅 → `apiFetch('/api/...')` → 기존 route handler(`memberRoute` 인증·`{code}` 에러) → `lib/*`.

## 이 도메인이 보여주는 패턴

- **목록 + 서버 prefetch→hydrate**: `ArtworkListPage`(lib prefetch) → `ArtworkListClient`
- **상세 (추천여부 합성)**: `fetchArtworkDetail`이 `getArtworkDetail` + `getEngagement`를 합쳐 내려줌
- **낙관적 뮤테이션 + 롤백 + 비즈니스 에러(code) 분기**: `useToggleRecommendMutation`
  (`already_downloaded` 거부 → 롤백 후 `showErrorToast(code)`)

## 사용 예 (app 라우트에서)

```tsx
// app/page.tsx (홈)
import { ArtworkListPage } from "@/domains/artwork/artwork-list-page";
export default function Home() {
  return <ArtworkListPage limit={8} />;
}
```
