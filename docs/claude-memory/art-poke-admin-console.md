---
name: art-poke-admin-console
description: 어드민 콘솔 확장 로드맵 — Phase 1 행동분석/현황 대시보드 스펙(issue
metadata: 
  node_type: memory
  type: project
  originSessionId: 2f13fe86-8de2-4d0f-825d-7d589c6f3f01
---

art-poke `/admin` 콘솔을 작품·신고 관리에서 **운영/마케팅 대시보드**로 확장하는 다단계 작업.

- **Phase 1 (구현 완료, 브랜치 `feat/admin-phase1-insights` 커밋 662baab, 미배포/미PR, 2026-11-17)** — issue [art-poke/pokeca#10](https://github.com/art-poke/pokeca/issues/10): 자체 구축 행동분석 + 현황 대시보드.
  - 구현 파일: `lib/analytics/tracker.tsx`(클라), `lib/analytics/events.ts`(+test), `app/api/events/route.ts`(동기 insert로 전환), `lib/admin-insights.ts`(+test), `app/admin/(console)/insights/page.tsx`, `app/admin/(console)/page.tsx`(현황 랜딩), layout 네비, `components/app-shell.tsx` data-track, `infra/db/migrations/20261117_170000_events_indexes.sql`.
  - 검증: typecheck·lint·build 통과, 유닛 14/14, 로컬 마이그레이션 적용됨. **배포 안 함** — 프로드는 migrate Lambda로 인덱스 마이그레이션 + `deploy.sh` 필요.
  - topContent는 v1에서 source_click 기준만(카드 page_view→card 매핑은 추후). R3 배칭 defer.
  - **런타임 함정(테스트로 발견·수정, 커밋 6e514b3)**: `events` 테이블에 raw SQL CHECK 제약 `events_type_check`(visit/search/download/source_click/request만 허용)가 있어 page_view/page_leave/click insert가 런타임 거부됨. Drizzle 미러(schema.ts)엔 안 보여서 typecheck/build로 못 잡음 → `/api/events`는 204 반환하지만 DB insert 실패. 마이그레이션 `20261117_173000_events_type_check.sql`로 제약 확장 + `01_app.sql:149` 동기화. **events.type 추가할 땐 이 CHECK 제약도 반드시 같이 고칠 것.**
  - 로컬 테스트 완료: /api/events 검증·exclusion·동기insert, 집계, auth guard, /admin·/admin/insights 브라우저 렌더 전부 확인. 로컬 어드민 계정 `admin@pokeca.local`/`testpw1234` 생성해둠(dev 편의).
  - **2026-11-17 운영 배포 완료** → https://artpokeca.com 라이브. 운영 DB 마이그레이션(migrate Lambda로 events_indexes+events_type_check 적용) + `deploy.sh`. 스모크: 홈200·/admin→login 307·/api/events page_view 204·invalid 400·admin경로 skip 전부 OK.
  - ⚠️ 배포는 `feat/pokepet-game` 체크아웃(=main+admin작업+pokepet docs)에서 돌림 — **admin 코드는 아직 main 미머지**(브랜치 `feat/admin-phase1-insights` 푸시됨). 즉 프로드가 main보다 앞섬 → PR #10 머지 필요.
  - 기존 `events` 테이블(type/visitor_id/card_id/artwork_id/payload jsonb) + httpOnly `vid` 쿠키 재사용, **DB 마이그레이션 없음**.
  - 신규: `lib/analytics/tracker.ts`(page_view/page_leave dwell/click, root layout 마운트, admin·artist 경로 제외), `/api/events` type 화이트리스트 확장, `lib/admin-insights.ts` 집계(KST 기준), `/admin/insights` 대시보드, `/admin` 랜딩을 현황+경보로 교체.
  - `search`·`source_click` 이벤트는 `recordSearch`(lib/cards.ts:118)·api/events로 **이미 수집 중** → 집계만.
  - 결정: 클릭=큐레이트 data-track 라벨 / 이벤트 전부 보관 / admin·봇 제외 / 시간대 KST.
  - **eng review(APPROVE WITH CHANGES, 2026-11-17)**: R1 `events` 인덱스 마이그레이션 추가(PK만 있음 → `(type,created_at DESC)`+`(visitor_id)`, 집계 seq-scan 방지) / R2 **구현 전** 프로드 `after()` 전달 검증(Lambda freeze 시 insert 유실 가능; source_click 행 존재 확인, 유실 시 동기 insert) / R3 배칭 defer. 보고서: `~/.gstack/projects/art-poke-pokeca/main-eng-review-...md`.
- **Phase 2**(회원·커뮤니티·리뷰 운영관리), **Phase 3**(요청·아티스트·게임): 별도 스펙 예정.

참고: 포크라 `art-poke/pokeca`는 원래 issues 비활성이었음 → 이번에 활성화함. gh 기본레포도 `art-poke/pokeca`로 set-default(안 하면 업스트림 ddol9로 해석됨). [[art-poke-github-fork]] [[art-poke-aws-migration]] [[art-poke-frontend-architecture]]
