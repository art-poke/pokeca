---
name: art-poke-monsterball-game
description: "몬스터볼 수박게임(머지 미니게임) — 2026-11-17 상용 배포 완료(artpokeca.com/play), main 머지됨 + 환경 함정"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2813acb0-c034-4df5-9356-3a5abc0af035
---

몬스터볼 테마 수박게임(머지 퍼즐) 웹게임. 목적=체류·재방문+랭킹. **2026-11-17 상용 배포 완료 — https://artpokeca.com/play** (main 머지 + `scripts/deploy.sh` + migrate Lambda로 game_scores 적용). 배포 방법은 [[art-poke-aws-migration]] 참고.

**스펙/계획**: `pokeca/docs/superpowers/specs/2026-11-17-monsterball-merge-game-design.md`, `.../plans/2026-11-17-monsterball-merge-game.md`. 레이아웃 목업: `.../mockups/2026-11-17-play-layout.html`.

**구조**: 3층 분리 — `domains/game/engine/`(순수 TS: ladder/physics(matter.js 헤드리스)/merge/deadline/game) · `domains/game/components/`(canvas 렌더러·이펙트·ball-sprites·캐비닛·HUD·리더보드) · `lib/game.ts`(리더보드/insert/throttle) + `app/api/game/score/route.ts` + `app/play/`. 11등급 볼, 하위 5개만 드롭. 점수 삼각수. 자체 SVG 볼(공식 스프라이트 저작권 회피 — [[art-poke-card-images-broken]]과 같은 이유).

**검증 상태**: typecheck 0, eslint 0(게임파일), vitest `--project game` 42 pass, `npm run build` 성공, 라이브 dev서버 API 스모크 OK.

**남은 피드백(미반영)**: 사용자가 ① 한 화면 fit(레터박스로 일부 대응했으나 전역 레이아웃 헤더/푸터와 최종 확인 필요) ② 다음볼 대기열을 "공장 컨베이어" 연출로 요청 → HUD에 기본 컨베이어는 넣었지만 "제조 애니메이션" 디테일은 더 다듬을 여지.

**환경 함정(이 레포 특유)**:
- **마이그레이션**: drizzle-kit 아님. `infra/db/migrations/*.sql` 수기 + `lib/db/schema.ts` 미러. 러너 `npm run db:migrate`가 이 환경 Node 20.20에선 `.mts` 미지원으로 실패 → **`node_modules/.bin/tsx --env-file-if-exists=.env.local scripts/db-migrate.mts`로 실행**. (상세 [[art-poke-snkrdunk-catalog]] 인접)
- **e2e**: 로컬에 이미 `npm run dev`(:3000) 떠 있으면 Next 16이 2번째 dev서버를 막아 playwright webServer(:3100)가 못 뜸. 소셜 세션은 `socialSessionCookies`가 throw(OAuth 콘솔 없음) → **admin 크리덴셜 `sessionCookies(ADMIN...)`** 로 로그인 흉내(admin도 session.user.id 있어 게이트 통과). vitest엔 DB리시드 없는 `game` 프로젝트 추가함(`--project game`).
- 인증 게이트는 `currentMember`/`currentArtist` 쓰면 안 됨(소셜만 통과) → **`auth()` + `session.user.id`** 직접(모든 provider 허용).
