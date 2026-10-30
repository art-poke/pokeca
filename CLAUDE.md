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

## gstack

플래닝·디자인·리뷰는 gstack 스킬을 쓴다: `/office-hours`(제품 재구성), `/spec`(스펙화),
`/plan-eng-review`·`/plan-design-review`·`/autoplan`(계획 검토), `/design-shotgun`(목업),
`/review`·`/qa`·`/ship`(구현·검증·출하).
웹 브라우징은 이 환경의 `ego-browser` 스킬을 우선 사용한다.
