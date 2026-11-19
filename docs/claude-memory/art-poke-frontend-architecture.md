---
name: art-poke-frontend-architecture
description: "art-poke 프론트 — 단일 풀스택 Next(모놀리식) + react-query DDD 수직슬라이스, canonical=domains/artwork"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5c9289bf-8df0-4505-a4db-c3c041fc67ce
---

art-poke(`pokeca`) 프론트를 health-lifecatch 참조 DDD 수직슬라이스로 재설계. **최종 확정(2026-11-01): 백엔드 분리 안 함, 단일 풀스택 Next(모놀리식).** (초기엔 "별도 백엔드 BFF"로 설계했다가 선회 — 비영리 소규모+솔로라 분리 트리거 없음. 백엔드 앱 자체도 없었음: infra Terraform+헬스체크 스텁만, 현 데이터=Supabase.)

**핵심 결정:**
- **단일 풀스택 Next.** 같은 Next 안의 `lib/*`(서버 로직)+기존 `app/api/*` route가 곧 서버. 별도 백엔드 없음. 그 위에 react-query를 얹어 캐싱/에러 일관성.
- 데이터 경로: **읽기**=서버컴포넌트/서버액션이 `lib/*` 직접 호출(네트워크 홉 없음). **쓰기**=클라 훅이 `lib/api/client`의 `apiFetch('/api/...')` → 기존 route handler.
- 레이어: `domains/{도메인}/{api(queries/types/endpoints/actions), hooks, components, *-page.tsx}`. 의존 한 방향(components→hooks→api).
- **Canonical reference = `domains/artwork/`** (새 도메인은 복사). 규칙은 `pokeca/CLAUDE.md`.
- 공통 인프라 `lib/`: `api/client`(apiFetch)·`api/errors`(ApiError{code,status})·`api/error-codes`(SSOT 에러문구)·`query/query-client`(throwOnError:false 등 never-freeze)·`query/prefetch`·`query/safe-hydration-boundary`·`toast/gr-toast`.
- react-query v5. 읽기=throw(쿼리 처리), 쓰기=apiFetch가 ApiError throw→훅 onError에서 code 분기. mutation 낙관적+롤백.
- eslint 경계: sonner `toast` 직접 import 금지(gr-toast만), 컴포넌트는 api/actions·queries 직접 import 금지.
- **분리는 네이티브앱/독립확장 트리거 생기면 그때** — actions.ts를 HTTP 호출로 바꾸는 리팩터링 수준.

**진행 상태:**
- `main`(78d9cc0) = 초기 BFF 스캐폴딩(serverApi/envelope 포함, **이젠 outdated**). origin에 push됨. **아직 브랜치 미반영.**
- 브랜치 `feat/frontend-wire-migrate`(main 미반영): `b899efe`(모놀리식 전환) + 도메인 마이그레이션 커밋들(report·search-request·artist·comment·community·card-request·ArtworkItem다운로드·recommend·upload·review·member·admin). `6d06230`은 병렬 인프라 에이전트 커밋을 분리한 것.
- **components의 생 fetch 16곳 전부 제거 완료.** 도메인: artwork, favorite, auth(X-삭제됨), report, search-request, artist, comment, community, card-request, review, member, admin. 전체 tsc 0 / eslint 0.

**도메인 목록(현재):** artwork, favorite, report, search-request, artist, comment, community, card-request, review, member, admin.

**주의:** pokeca 레포에 **병렬 에이전트(인프라)가 동시에 커밋**함 — staged 상태로 두면 휩쓸림. 동시작업 중 git 조작 주의.

**남은 것:** 브랜치 `feat/frontend-wire-migrate`를 main에 merge(사용자 승인 대기), artwork/카드 라우트 페이지를 새 도메인 페이지로 교체(선택), 실제 백엔드는 모놀리식이라 불필요.

관련: [[art-poke-design-system]] [[art-poke-github-fork]] [[art-poke-aws-migration]]
