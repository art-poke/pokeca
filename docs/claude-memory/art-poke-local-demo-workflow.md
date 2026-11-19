---
name: art-poke-local-demo-workflow
description: art-poke 로컬 데모 데이터와 테스트가 dev DB를 공유하는 문제 + 자동 재시드 해결책
metadata: 
  node_type: memory
  type: project
  originSessionId: b225d66b-ab47-439f-af42-79fe0b3d095f
---

art-poke(pokeca)의 통합 테스트(`tests/integration/*`)는 **로컬 dev DB를 그대로 공유**한다. 각 테스트의 beforeEach가 `truncate`/auth 유저 삭제를 해서, 로컬에서 UI 미리보기용으로 깔아둔 데모 데이터(작가·도안·회원·즐겨찾기·요청·커뮤니티)가 **테스트를 돌릴 때마다 날아간다.**

**해결(2026-10-31 적용):**
- `npm run demo` 한 방으로 전체 데모 재시드(= demo:seed → demo:artists → demo:community → demo:requests → demo:resolve → demo:favorites). 각 하위 스크립트도 `npm run demo:*`로 개별 존재.
- vitest가 통합 테스트 끝나면 **자동으로 `npm run demo` 실행**(`tests/reseed-teardown.ts` globalSetup teardown, `vitest.config.mts` db 프로젝트에 연결). `.env.local` 없으면(=CI) 건너뜀. 그래서 테스트를 돌려도 로컬 UI 데이터는 항상 복구된다.
- `.mts` 시드 스크립트는 **Node 22 필요**(`/opt/homebrew/opt/node@22/bin`). 기본 node가 20이면 실패.
- 시드 스크립트의 `listUsers({perPage:200})` 버그 수정됨(테스트가 auth 유저를 수백 개 쌓아 1페이지로 못 찾던 것 → page 루프 perPage 1000).

**별도 테스트 DB는 안 씀:** Supabase 로컬은 Auth·Storage·API가 하나의 스택(postgres)에 묶여 있어 DB만 분리 불가. 두 번째 스택은 과함 → 자동 재시드가 현실적 최선.

**남은 이슈:** `search.test`·`card-import.test` 4건은 `supabase/seed.sql`의 3장 픽스처를 기대하는데 dev DB엔 전체 카탈로그(1430장)가 들어 있어 항상 실패(assertion mismatch, 데이터 삭제와 무관). `supabase db reset`하면 통과하지만 카탈로그+데모가 날아감. 관련: [[art-poke-design-system]]
