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

## 레포 스킬 목록

| 요청 | 스킬 |
| --- | --- |
| 카드 이야기 조사·집필·편집 | [card-story-editor](.agents/skills/card-story-editor/SKILL.md) |
| 일본판 카드 추가·검색 누락 조사·운영 카탈로그 반영 | [snkrdunk-catalog](.agents/skills/snkrdunk-catalog/SKILL.md) |
| 카드 원본의 시점·출연진·색·네 변 분석, 비교 사례 추가 | [card-art-analysis](.agents/skills/card-art-analysis/SKILL.md) |
| BRG·PSA·9포켓 확장아트 제작, 생성 지시 작성, 시안 수정 | [card-extended-art](.agents/skills/card-extended-art/SKILL.md) |
| 완성된 확장아트의 신체·배경 연결과 인쇄 상태 검수 | [card-art-review](.agents/skills/card-art-review/SKILL.md) |

요청에 해당하는 스킬을 읽고 적용한다.

확장아트 제작 요청은 주 에이전트가 프로젝트 전용 에이전트 `card_art_director`에 맡긴다. 요청 규격과 카드 이미지 경로 또는 품번을 함께 전달한다. 호출 도구에서 사용자 정의 역할을 선택할 수 없으면 작업 에이전트 한 명에게 [.codex/agents/card_art_director.toml](.codex/agents/card_art_director.toml)의 지침과 같은 입력을 전달한다. 제작 담당자가 분석 → 생성·합성 → 검수와 필요한 수정을 수행한다. 주 에이전트는 현 회차의 결과와 미리보기를 전달한다. 분석·사례 추가·검수만 요청하면 해당 범위에서 마친다.
