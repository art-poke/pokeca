---
name: art-poke-design-system
description: "art-poke/pokeca 디자인시스템 전면 리뉴얼 프로젝트 — 몬스터볼 테마, Tailwind+shadcn+Storybook 전환"
metadata: 
  node_type: memory
  type: project
  originSessionId: b225d66b-ab47-439f-af42-79fe0b3d095f
---

art-poke/pokeca(포켓몬 카드 확장 아트 아카이브, Next.js 16 + Supabase)의 디자인을 전면 리뉴얼 중. 2026-10-31 시작.

**결정 사항:**
- 스택: CSS Modules → **Tailwind v4 + shadcn 전면 전환** (점진 이관, 레거시 토큰 보존)
- 컴포넌트 문서화: **Storybook** (10.x, @storybook/nextjs-vite)
- 범위: **전 화면 리디자인**
- 테마: **몬스터볼(레드·화이트·블랙)**. 시그니처 레드 = **#EE1515** (red-500). 블랙 ink-900 #111113, 서피스 화이트/gray.
- 폰트: Pretendard(본문) + Wanted Sans(제목), 둘 다 이미 설치됨.

**진행 상황:**
- Phase 1(Tailwind+shadcn 토대) ✅ — postcss.config.mjs, components.json, lib/utils.ts(cn), app/globals.css(@theme 몬스터볼 토큰+시맨틱+다크), components/ui/{button,input,badge}.tsx
- Phase 2(Storybook) ✅ — .storybook/, 아톰 3종 스토리, localhost:6006
- Phase 3(컴포넌트 라이브러리) ⬜ 진행 예정
- Phase 4(전 화면 리디자인: 홈→검색→카드상세→작가→어드민) 대부분 완료(어드민 CSS Modules 일부 잔존)

**커뮤니티·랭킹 에픽 (2026-10-31, /spec→/autoplan→구현, main 커밋됨):** 일반 회원(member, 소셜) + 추천/다운로드 점수(engagements, 유저·도안당 1점 배타, 다운로드 회원전용) + 랭킹(/ranking 금주·이번달·역대 × 작가/도안, 홈 실제집계) + 도안 상세 `/artworks/[id]`(모달 제거, 댓글 대댓글·추천) + 도안요청 `/requests` + 커뮤니티 `/community`(공지/건의/자유). 스펙: docs/designs/community-ranking-epic.md. 통합테스트 tests/integration/engagements.test.ts. **미해결: 소셜 OAuth 로컬 미설정이라 로그인 플로우(추천/다운로드/댓글/글쓰기) 클릭 테스트는 배포 후.** 데모 시드: scripts/seed-community.mts, seed-requests-fix.mts. gstack 설치됨(~/.claude/skills/gstack).

**리서치 산출물:** `docs/design-research/` — toss/daangn/dcinside/blind 캡처+데이터화(7장+7 JSON), extract.mjs, SYNTHESIS.md(토큰·컴포넌트 아키텍처·홈 후킹 컨셉 전문). 공통 패턴: 검색-퍼스트, 넘버드 랭킹 리스트, 카테고리 아이콘 타일, 2컬럼→1컬럼.

**로컬 실행:** Node 20(프로젝트는 22 권장이나 동작), Docker 필요. `npm run db:start`(Supabase 54321/Studio 54323) → `npm run dev`(3000) → `/design` 갤러리. Storybook `npm run storybook`(6006). 관련: [[art-poke-github-fork]]
