# Memory Index

- [art-poke 디자인시스템](art-poke-design-system.md) — 몬스터볼 테마(#EE1515) Tailwind+shadcn+Storybook 전면 리뉴얼, 진행 단계
- [art-poke GitHub 포크](art-poke-github-fork.md) — ddol9/pokeca 포크, clyde-yoonjae 계정으로 작업
- [art-poke 로컬 데모/테스트 워크플로](art-poke-local-demo-workflow.md) — 테스트가 dev DB 공유해 데모 날림 → `npm run demo` + 테스트 후 자동 재시드
- [art-poke 프론트 아키텍처](art-poke-frontend-architecture.md) — 별도 백엔드 BFF + DDD 수직슬라이스, canonical=domains/artwork, 브랜치 feat/frontend-architecture
- [art-poke AWS 이전/배포](art-poke-aws-migration.md) — **상용 LIVE https://artpokeca.com** (AWS: Lambda+RDS+CloudFront+S3+Auth.js). **배포=`AWS_PROFILE=artpoke bash scripts/deploy.sh`**, 운영DB=migrate Lambda, 계정 138681986450. "어디 떠있나/배포 어떻게"는 이 메모 + 레포 `CLAUDE.md` 상단
- [art-poke AWS 계정 분리](art-poke-aws-account-separation.md) — 회사(gr-readonly)↔개인(artpoke) 철저 분리, 모든 호출 --profile artpoke 필수
- [art-poke 카드 이미지 깨짐](art-poke-card-images-broken.md) — 공식 카드 이미지 S3 객체 없어 로컬·프로드 전부 404, UI서 실제 이미지 의존 금지
- [art-poke SNKRDUNK 카탈로그](art-poke-snkrdunk-catalog.md) — 일어판 카드 수집 파이프라인(docs/snkrdunk-catalog.md), 검색 통합, 배포 함정(앱Lambda 70MB→S3)
- [art-poke 몬스터볼 게임](art-poke-monsterball-game.md) — 수박게임 미니게임(matter.js), feat/monsterball-merge-game 구현완료, 마이그레이션/e2e 환경함정
- [art-poke 어드민 콘솔](art-poke-admin-console.md) — /admin 확장 로드맵, Phase1 행동분석/현황 대시보드 스펙(issue #10)
