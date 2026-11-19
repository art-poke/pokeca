---
name: art-poke-snkrdunk-catalog
description: SNKRDUNK 일어판 카드 수집 파이프라인 + 상용 배포 함정(앱 Lambda 70MB)
metadata: 
  node_type: memory
  type: project
  originSessionId: 43b500c9-a2c6-4230-a50f-33afd76b9034
---

art-poke에 **SNKRDUNK 일어판 카드 카탈로그**를 추가함(포켓몬/트레이너 단위 인기순 수집). 2026-11-06 상용 반영.

- `snkrdunk_cards`는 **스테이징(raw 크롤)**. 마이그레이션 `20261107_snkrdunk_merge`가 **gap(한글판에 없는) 일어판 카드를 `cards`에 정식 편입**(`cards.lang='ja'`, 일어판 세트는 `sets`에 추가해 FK 충족, 한글 검색 위해 `name_ko` 앞에 `species_ko` 붙임). 그래서 일어판도 검색·상세·확장아트·즐겨찾기·요청이 **한글판과 완전히 동일하게** 동작(특수처리 없음). 겹치면 편입 안 함=한글판 우선. 이미지 `/api/jp-card-images`(로컬 .cache→없으면 S3 `jp-cards/`), `cardImageUrl(path, lang)`로 분기.
- 재현 가이드/절차 전부: **`docs/snkrdunk-catalog.md`** (대상목록 `scripts/snkrdunk-targets.json` 편집 → `scripts/fetch-snkrdunk.mjs` 수집 → 시드 재생성 → S3 이미지 업로드 → deploy + migrate Lambda).
- 현재 적재: 뮤츠 + 여자 트레이너 31종 = 1179장(상용 RDS + S3).

**배포 함정(다음에 반복 금지)**:
- 앱 Lambda zip이 70MB 직접 업로드 한도 초과 → `app_server`를 **s3_bucket/s3_key**로 전환(deploy.sh가 apply 전 assets 버킷에 업로드). [[art-poke-aws-migration]]
- OpenNext가 프로젝트 루트 `.cache`(로컬 이미지 62MB)를 서버 번들에 포함 → deploy.sh zip에서 `-x '.cache/*'` 제외(70MB→17MB).
- 상용 RDS는 프라이빗이라 노트북 직접 접속 불가 → 스키마+데이터 모두 **마이그레이션 파일**(`infra/db/migrations/`, Lambda 복사본 `infra/lambda-migrate/sql/`)로 넣고 `aws lambda invoke --function-name pokeca-migrate --region ap-northeast-1`로 적용.
