# artwork — Canonical Reference 도메인

**새 도메인을 만들 땐 이 폴더를 통째로 복사해서 이름만 바꾼다.** 레이어 규칙은 루트 `CLAUDE.md` 참조.

## 파일별 역할

| 파일 | 역할 | 의존 가능 |
|---|---|---|
| `api/endpoints.ts` | 엔드포인트 상수 | — |
| `api/types.ts` | `Server*`(wire) + Client 타입 | — |
| `api/queries.ts` | Query Key Factory | — |
| `api/actions.ts` | `"use server"` 데이터 함수 (읽기=throw, 쓰기=`withErrorHandling`) | server-fetch, transform, endpoints, types |
| `transform.ts` | Server→Client 변환 (순수함수) | types |
| `hooks.ts` | react-query 훅 (`"use client"`) | actions, queries, types |
| `components/*` | 표현/상호작용 | **hooks만** (actions/queries 직접 X) |
| `artwork-*-page.tsx` | 서버컴포넌트 prefetch + hydrate | actions, queries, components |

## 이 도메인이 보여주는 패턴

- **목록 무한스크롤**: `useArtworksQuery` + `ArtworkListClient`(IntersectionObserver)
- **상세 + 서버 prefetch→hydrate**: `ArtworkDetailPage` → `ArtworkDetailClient`
- **낙관적 뮤테이션 + 롤백 + 비즈니스 에러(code) 분기**: `useToggleRecommendMutation`
  (`already_downloaded` 같은 거부는 롤백 후 안내 토스트)
- **Server/Client 타입 분리 + Transformer**: 백엔드 응답이 바뀌어도 UI는 무영향

## 사용 예 (app 라우트에서)

```tsx
// app/artworks/[id]/page.tsx
import { ArtworkDetailPage } from "@/domains/artwork/artwork-detail-page";
import { currentMember } from "@/lib/members"; // 인증 레이어

export default async function Page({ params }: PageProps<"/artworks/[id]">) {
  const { id } = await params;
  const member = await currentMember();
  return <ArtworkDetailPage id={id} isMember={!!member} />;
}
```
