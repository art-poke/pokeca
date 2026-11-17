# 몬스터볼 수박게임 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** art-poke에 몬스터볼 테마 수박게임(머지 퍼즐) 미니게임을 추가하고, 로그인 유저의 점수를 역대/월별 리더보드로 경쟁시킨다.

**Architecture:** 순수 TS 게임엔진(matter.js 헤드리스) / React·캔버스 렌더러 / Next.js 백엔드의 3층 분리. 엔진은 React·캔버스를 모르고 `onMerge` 이벤트만 emit, 렌더러가 이펙트·그림을 담당. 점수는 서버에서 가볍게 검증 후 `game_scores`에 저장.

**Tech Stack:** Next.js 15(App Router), React, TypeScript, matter.js, drizzle-orm/pg, @tanstack/react-query, next-auth, vitest, playwright, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-17-monsterball-merge-game-design.md`

---

## 확정 수치 (spec §14 lock-in)

모든 수치는 `domains/game/engine/ladder.ts`의 config 상수로 둔다(가상 좌표계).

**가상 월드:** `WORLD_WIDTH=360`, `WORLD_HEIGHT=540`, `WALL_THICKNESS=60`, `DEADLINE_Y=100`
**물리:** gravity.y=1, 고정 타임스텝 `1000/60`ms
**드롭:** 쿨다운 `DROP_COOLDOWN_MS=500`, 드롭 후 `DROP_GRACE_MS=600`간 해당 공은 게임오버 판정 제외
**게임오버:** 어떤 공의 (중심-반지름)이 `DEADLINE_Y`보다 위(y가 더 작음)에 `GAME_OVER_MS=1000` 연속 유지
**다음 볼 랜덤 풀:** tier 1~5, 가중치 `[0.30, 0.28, 0.22, 0.14, 0.06]` (주입식 RNG로 결정론 테스트)

**11등급 사다리** (`radius` 가상단위, `score`=그 등급을 "생성"할 때 가산 점수, 삼각수):

| tier | name      | radius | score | droppable | topColor  | accentColor |
|------|-----------|--------|-------|-----------|-----------|-------------|
| 1    | 몬스터볼   | 16     | 0     | ✅        | #EE1515   | #B00D0D     |
| 2    | 수퍼볼     | 22     | 1     | ✅        | #2F6DB5   | #D13B3B     |
| 3    | 하이퍼볼   | 30     | 3     | ✅        | #E6B422   | #1A1A1A     |
| 4    | 프리미어볼 | 38     | 6     | ✅        | #F5F5F5   | #EE1515     |
| 5    | 다크볼     | 46     | 10    | ✅        | #2E3B33   | #39C07A     |
| 6    | 네스트볼   | 56     | 15    |           | #7AB648   | #E8A13B     |
| 7    | 타이머볼   | 68     | 21    |           | #D7D2CB   | #D13B3B     |
| 8    | 퀵볼       | 82     | 28    |           | #30B8D8   | #F2C933     |
| 9    | 힐볼       | 98     | 36    |           | #F09BC0   | #EE5FA0     |
| 10   | 러브볼     | 116    | 45    |           | #E85A9B   | #FFFFFF     |
| 11   | 마스터볼   | 136    | 55    |           | #5A2D8C   | #E24B9A     |

- tier1 생성 점수 0(드롭만 함). tier T(2..11) 생성 점수 = `(T-1)*T/2`.
- 모든 볼 하단색 = white(#FFFFFF), 밴드색 = #1A1A1A, 중앙버튼 = white 링 + accent 점.
- **마스터볼(11)끼리 머지**: tier12 없음 → 둘 다 제거 + 보너스 `MASTER_POP_BONUS=100`.

**검증 수치(`validation.ts`):**
- `score ≥ 0` 그리고 `score ≤ ballsPlaced * 60`
- `durationMs ∈ [3000, 7_200_000]`
- `ballsPlaced ∈ [1, 100_000]`, `maxTier ∈ [1, 11]`
- 제출 빈도: 유저당 **시간당 20회** 초과 거절

---

## File Structure

```
domains/game/
  engine/{ladder,types,merge,physics,game}.ts
  validation.ts
  api/{endpoints,types,queries,actions}.ts
  hooks.ts
  components/{game-canvas,game-cabinet,game-hud,game-leaderboard}.tsx
  components/{ball-sprites,effects}.ts
domains/game/engine/__tests__/*.test.ts
domains/game/__tests__/validation.test.ts
app/play/{page,loading}.tsx
app/api/game/score/route.ts
lib/db/schema.ts            (modify: + gameScores)
tests/e2e/play.spec.ts      (playwright)
```

디자인 규칙(프로젝트 CLAUDE.md): 화살표 함수만, 파일 kebab-case, `type`만(interface 금지), `@/` 절대경로, API 경로는 endpoints.ts 상수.

---

## Task 0: 의존성 설치

**Files:** `package.json`

- [ ] matter.js + 타입 설치
  Run: `npm i matter-js && npm i -D @types/matter-js`
  Expected: 설치 성공, package.json에 추가
- [ ] Commit: `chore: add matter-js dependency`

## Task 1: `ladder.ts` + 테스트 (순수 config)

**Files:** Create `domains/game/engine/ladder.ts`, Test `domains/game/engine/__tests__/ladder.test.ts`

- [ ] **Step 1 (test first):** 다음을 검증하는 실패 테스트 작성
  - `TIERS.length === 11`
  - radius가 tier 오름차순으로 **단조증가**
  - score: tier1=0, tier T=`(T-1)*T/2`
  - droppable tier는 1~5뿐 (`droppableTiers()` → `[1,2,3,4,5]`)
  - `nextTier(T)` = T+1 (단, 11이면 null)
  - `tierConfig(T)` 유효 범위 밖이면 throw
- [ ] **Step 2:** 실패 확인 `npx vitest run domains/game/engine/__tests__/ladder.test.ts`
- [ ] **Step 3:** `ladder.ts` 구현 — 위 확정 표를 `TIERS: readonly TierConfig[]`로, 월드/물리/드롭/게임오버/가중치 상수 export, `nextTier`/`tierConfig`/`droppableTiers`/`pickDropTier(rng)` 헬퍼(화살표 함수).
- [ ] **Step 4:** 테스트 PASS 확인
- [ ] **Step 5:** `pickDropTier` 결정론 테스트 추가 — RNG가 0.0, 0.99 반환 시 각각 tier1, tier5. PASS 확인.
- [ ] **Step 6:** Commit `feat(game): 볼 사다리 config + 헬퍼`

## Task 2: `types.ts` (엔진 공용 타입)

**Files:** Create `domains/game/engine/types.ts`

- [ ] `BallSnapshot = { id:number; tier:number; x:number; y:number; radius:number; angle:number }`
- [ ] `GameSnapshot = { score:number; nextTier:number; dropX:number; isGameOver:boolean; balls:BallSnapshot[] }`
- [ ] `MergeEvent = { x:number; y:number; tier:number; score:number; isMaster:boolean }`
- [ ] `Rng = () => number` (0..1)
- [ ] Commit `feat(game): 엔진 공용 타입`

## Task 3: `merge.ts` (순수 머지 규칙) + 테스트

순수 함수로 분리(물리 바디 없이 테스트 가능). "두 같은 등급 입력 → 결과"만 계산.

**Files:** Create `domains/game/engine/merge.ts`, Test `.../__tests__/merge.test.ts`

- [ ] **Step 1 (test):**
  - `resolveMerge(3)` → `{ nextTier:4, score:6, isMaster:false }`
  - `resolveMerge(10)` → `{ nextTier:11, score:55, isMaster:false }`
  - `resolveMerge(11)` → `{ nextTier:null, score:100, isMaster:true }` (마스터 팝 보너스)
- [ ] **Step 2:** 실패 확인
- [ ] **Step 3:** 구현 (ladder 상수 사용)
- [ ] **Step 4:** PASS 확인 → Commit `feat(game): 머지 규칙(순수)`

## Task 4: `physics.ts` (matter.js 월드 팩토리) + 테스트

matter.js를 감싸 월드 생성·벽·바디 추가/제거만 담당. 렌더러 미부착.

**Files:** Create `domains/game/engine/physics.ts`, Test `.../__tests__/physics.test.ts`

- [ ] **Step 1 (test):** `createPhysics()` 반환 객체가
  - gravity.y === 1, 정적 벽 3개(좌/우/바닥) 존재
  - `addBall(tier, x)` → body 반환, world.bodies에 포함, body.label === `ball:<tier>`, circleRadius === tier radius
  - `removeBall(body)` 후 world에서 제거됨
  - `step(dt)` 호출 시 바닥 위 공의 y가 중력으로 증가(낙하)
- [ ] **Step 2:** 실패 확인
- [ ] **Step 3:** 구현 — `Engine.create`, `Composite.add` 정적 벽, `Bodies.circle`(label, restitution≈0.1, friction 적당), `Engine.update(engine, dt)`.
- [ ] **Step 4:** PASS 확인 → Commit `feat(game): matter.js 물리 월드 팩토리`

## Task 5: `game.ts` (상태 기계) + 테스트

물리+머지+상태+게임오버 오케스트레이션. RNG 주입(결정론). `collisionStart`에서 같은 label 두 바디 머지(중복 머지 플래그). `onMerge` 콜백.

**Files:** Create `domains/game/engine/game.ts`, Test `.../__tests__/game.test.ts`

- [ ] **Step 1 (test):**
  - `new Game({ rng, onMerge })` 초기 snapshot: score 0, nextTier∈1..5, isGameOver false
  - `drop(x)`: 공 1개 추가, nextTier 갱신, 쿨다운 내 재드롭 무시
  - **머지 통합 테스트:** 같은 tier 공 2개를 서로 맞닿게 배치하고 여러 step → 공 1개(상위 tier)로, score 증가, onMerge 1회 호출, 중복 머지 없음
  - **게임오버:** 데드라인 위에 공을 두고 `GAME_OVER_MS` 이상 step → isGameOver true; 드롭 직후 `DROP_GRACE_MS` 내엔 오탐 없음
  - `getStats()` → `{ ballsPlaced, maxTier, durationMs }`
- [ ] **Step 2~4:** 실패 확인 → 구현 → PASS. (머지 통합 테스트는 실제 matter.js 사용, 완전 결정론 아님 → step 횟수 넉넉히/위치 여유있게 설계)
- [ ] **Step 5:** Commit `feat(game): 게임 상태기계(드롭·머지·게임오버)`

## Task 6: `validation.ts` (서버 검증) + 테스트

**Files:** Create `domains/game/validation.ts`, Test `domains/game/__tests__/validation.test.ts`

- [ ] **Step 1 (test):** `validateScoreSubmission(payload)` →
  - 정상 payload → `{ ok:true }`
  - score 음수 / `> ballsPlaced*60` → `{ ok:false, reason }`
  - durationMs 범위 밖, ballsPlaced/maxTier 범위 밖 → 거절
- [ ] **Step 2~4:** 실패 → 구현(순수 함수, 빈도제한은 별도 — route에서 reportThrottle 패턴) → PASS
- [ ] **Step 5:** Commit `feat(game): 점수 제출 가벼운 검증`

## Task 7: DB 스키마 `game_scores` + 마이그레이션

**Files:** Modify `lib/db/schema.ts`; 마이그레이션 생성

- [ ] `gameScores` pgTable 추가: id(uuid pk), userId(uuid→users.id), score(bigint), playedAt(timestamp, **서버 설정**), ballsPlaced(smallint), maxTier(smallint), durationMs(bigint), createdAt(timestamp). 인덱스: (score desc), (playedAt).
- [ ] Run: `npm run db:migrate` 또는 drizzle 생성 스크립트 확인 후 실행. Expected: 마이그레이션 파일 생성/적용.
- [ ] Commit `feat(game): game_scores 스키마 + 마이그레이션`

## Task 8: 도메인 API 레이어

**Files:** Create `domains/game/api/{endpoints,types,queries,actions}.ts`

- [ ] `endpoints.ts`: `GAME_ENDPOINTS = { score: "/api/game/score" } as const`
- [ ] `types.ts`: `ScoreSubmission`, `LeaderboardEntry`, `LeaderboardScope = "all"|"month"`, `LeaderboardResponse`
- [ ] `queries.ts`: `gameKeys` Query Key Factory + `useLeaderboard(scope)` (react-query, 4xx 재시도 금지)
- [ ] `actions.ts`: `submitScore(payload)` (fetch POST, 공유 패턴 준수)
- [ ] Commit `feat(game): 도메인 api 레이어`

## Task 9: API route `/api/game/score`

**Files:** Create `app/api/game/score/route.ts`

- [ ] `POST`: next-auth 세션 필수(없으면 401) → `validateScoreSubmission` → reportThrottle식 빈도제한(시간당 20) 초과 429 → `playedAt=now()` 서버설정으로 insert → 201
- [ ] `GET ?scope=all|month`: scope=all이면 유저별 MAX(score) 상위 N, month면 이번 달 `playedAt` 필터 후 유저별 MAX. 상위 100 + 현재 유저 순위 반환.
- [ ] 간단 통합 테스트(가능하면 vitest route 테스트, 어려우면 §16 e2e로 커버)
- [ ] Commit `feat(game): 점수 제출/리더보드 API route`

## Task 10: `ball-sprites.ts` (프로그래매틱 볼)

**Files:** Create `domains/game/components/ball-sprites.ts`

- [ ] `renderBallSprite(tier, pxRadius) → HTMLCanvasElement` : 상/하 2색 원 + 밴드 + 중앙 흰 링 + accent 점, 살짝 하이라이트. DPR 고려.
- [ ] `getBallSprite(tier, pxRadius)` : 캐시(동일 tier+radius는 1회만 렌더)
- [ ] 간단 테스트: 반환 canvas width/height가 지름*DPR과 일치(jsdom/offscreen 가능 범위) — 어려우면 스킵하고 e2e 스모크로.
- [ ] Commit `feat(game): 프로그래매틱 몬스터볼 스프라이트`

## Task 11: `effects.ts` (파티클 시스템)

**Files:** Create `domains/game/components/effects.ts`

- [ ] `EffectSystem`: `spawnMerge(ev)` → 파티클 버스트 + 확산 링 + 플로팅 점수; `update(dt)`; `draw(ctx)`. 수명 끝난 파티클 제거. 마스터는 더 큰 버스트+글로우.
- [ ] 순수 로직 테스트: spawn 후 update로 수명 경과 시 파티클 수 0으로 수렴.
- [ ] Commit `feat(game): 머지 이펙트 파티클 시스템`

## Task 12: `game-canvas.tsx` (렌더러·루프·입력)

**Files:** Create `domains/game/components/game-canvas.tsx`

- [ ] `'use client'`. mount 시 `new Game`, rAF 루프: `game.step(dt)` → snapshot 읽어 canvas에 탱크/볼(sprite)/크레인 그림, `effects.update/draw`. 입력: pointermove→dropX, pointerup/click→`game.drop(dropX)`(쿨다운은 엔진이 처리). 터치도 pointer 이벤트로 통합.
- [ ] 리사이즈 observer로 캔버스 CSS 크기 ↔ 가상 월드 스케일 계산. `visibilitychange`로 루프 일시정지.
- [ ] `game.onMerge` → `effects.spawnMerge`. 게임오버 시 `onGameOver(stats, score)` prop 호출.
- [ ] Commit `feat(game): 게임 캔버스 렌더러+입력 루프`

## Task 13: 주변 UI 컴포넌트

**Files:** Create `game-cabinet.tsx`, `game-hud.tsx`, `game-leaderboard.tsx`, `hooks.ts`

- [ ] `game-cabinet.tsx`: 인형뽑기 캐비닛 프레임(SVG/CSS, #EE1515 테마) — children으로 canvas 감쌈.
- [ ] `game-hud.tsx`: 점수, 다음 볼 미리보기, 게임오버 오버레이(재시작 + 점수 제출 상태).
- [ ] `game-leaderboard.tsx`: `useLeaderboard` 사용, 역대/월별 탭.
- [ ] `hooks.ts`: 게임오버 시 `submitScore` mutation 래핑 훅 + 토스트(sonner).
- [ ] Commit `feat(game): 캐비닛/HUD/리더보드 UI`

## Task 14: 라우트 `/play` + 인증 게이트

**Files:** Create `app/play/page.tsx`, `app/play/loading.tsx`; auth 패턴 확인

- [ ] `page.tsx`: 서버에서 세션 확인(기존 next-auth 패턴) → 비로그인 로그인 리다이렉트. 로그인 시 `game-cabinet > dynamic(game-canvas, {ssr:false})` + HUD + 리더보드 렌더.
- [ ] `loading.tsx`: Skeleton.
- [ ] Commit `feat(game): /play 라우트 + 인증 게이트`

## Task 15: E2E 스모크 (playwright)

**Files:** Create `tests/e2e/play.spec.ts` (기존 e2e 구조 확인 후 위치 맞춤)

- [ ] 비로그인 `/play` 접근 → 로그인으로 리다이렉트
- [ ] 로그인 상태(기존 e2e 인증 헬퍼 재사용) → `/play` 로드, canvas 존재, 클릭으로 공 드롭 후 공 개수 증가(또는 캔버스 렌더 확인)
- [ ] Run: `npm run test:e2e -- play.spec.ts`
- [ ] Commit `test(game): /play e2e 스모크`

## Task 16: 최종 검증

- [ ] `npm run typecheck` → 에러 0
- [ ] `npm run lint` → 에러 0
- [ ] `npx vitest run domains/game` → 전부 PASS
- [ ] `npm run test:e2e -- play.spec.ts` → PASS
- [ ] Commit(필요 시) `chore(game): 린트/타입 정리`

---

## YAGNI / 비목표
멀티플레이, 서버 재시뮬 안티치트, 재화·보상 연동, 외부/공식 스프라이트 — 모두 범위 밖.
