<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 프로젝트 공통 지침

작업을 시작할 때 `CLAUDE.md`를 읽고 제품 구조, 디자인 시스템, 프론트엔드
아키텍처 및 운영 절차를 따른다. Next.js 코드 변경에는 위의 문서 확인 규칙을 적용한다.

Codex에서는 현재 세션에서 사용 가능한 스킬만 호출한다. `CLAUDE.md`에 나오는
gstack 명령이나 `ego-browser`가 없으면 현재 세션의 도구로 해당 작업을 진행한다.
일본판 카드 카탈로그 추가, 검색 누락 조사, 운영 반영에는
`.agents/skills/snkrdunk-catalog/SKILL.md`를 사용한다.

## 카드 이야기 편집

카드 이야기의 새 글 작성과 기존 글 편집에는 `.agents/skills/card-story-editor/SKILL.md`를 사용한다.
이 레포에서 카드 주제로 “글 작성해줘”라고 요청하면 이 스킬을 적용한다.
