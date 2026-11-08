---
name: snkrdunk-catalog
description: Use when adding a new Pokémon or trainer's Japanese cards to the art-poke SNKRDUNK catalog, or when cards scraped from SNKRDUNK don't appear in search, or when deploying new JP card data/images to production. Covers fetch → stage → merge-into-cards → S3 images → prod migrate.
---

# SNKRDUNK 일어판 카드 카탈로그 추가

SNKRDUNK에서 포켓몬/트레이너 단위로 일어판 카드(메타+이미지)를 긁어 한글판 아카이브 검색에 통합한다. 전체 배경·설계는 `docs/snkrdunk-catalog.md`. 이 스킬은 **"새 종(種) 하나 추가 → 로컬 확인 → 상용 반영"**까지의 실행 절차다.

## 핵심 모델 (여기서 막힘)

- `snkrdunk_cards` = **스테이징**(raw 크롤). 검색/상세는 이걸 **직접 안 봄**.
- 검색에 뜨려면 **merge 마이그레이션**이 gap(한글판에 없는) 일어판 카드를 `cards`(lang='ja')로 **편입**해야 한다. `search_cards_by_name`은 `cards`만 본다.
- 그래서 **크롤만 하면 검색에 안 뜬다.** 반드시 merge를 (새 마이그레이션 파일로) 다시 돌려야 한다.

## 선결

- AWS는 **반드시 `--profile artpoke`** (계정 138681986450). 회사 계정 금지. `aws sts get-caller-identity --profile artpoke`로 확인.
- 로컬 DB: Docker Postgres 5432 기동(`docker-compose up -d`), `.env.local`의 `DATABASE_URL`.
- ⚠️ **node 20에서 `.mts` 실행이 깨진다**(`npm run db:migrate`/`demo` 포함). `node --import tsx ...`로 우회. (`.mjs`인 fetch 스크립트는 그냥 node로 OK.)

## 절차

### 1. 대상 추가 (`scripts/snkrdunk-targets.json`)
```json
{ "en": "lugia", "ko": "루기아" }
```
- `en` = SNKRDUNK 영문 검색어 겸 **단어경계 필터 needle**. `ko` = 한글 검색명(`species_ko`).
- ⚠️ **`--pokemon` 플래그를 쓰면 `ko` 매핑이 안 채워진다**(그때는 targets.json을 안 읽음). 특정 종만 임시로 크롤하려면 **`--targets`로 임시 JSON 파일**을 주되 `{en,ko}`를 포함시켜라.
- 이름 충돌 주의: 크롤러는 `/\b<en>\b/i` 단어경계로 거른다 → `mew`는 `Mewtwo`를 안 잡지만 `Mewtwo & Mew GX`(실제 뮤 포함 태그팀)는 잡는다(정상).

### 2. 크롤 (Playwright, 예의상 delay 1s 유지)
```bash
# 새로 추가한 것만: ko 포함된 임시 targets 파일로
printf '{"targets":[{"en":"lugia","ko":"루기아"}]}' > /tmp/t.json
node --env-file=.env.local scripts/fetch-snkrdunk.mjs --targets /tmp/t.json
```
로컬 `snkrdunk_cards` + `.cache/snkrdunk-images/`에 적재. 재실행 안전(source_id upsert, 받은 이미지 skip).

### 3. 시드 마이그레이션 생성 (**새 파일명** — 기존 시드 파일명은 이미 적용돼 재실행 안 됨)
```bash
docker exec pokeca-dev-db psql -U pokeca -d pokeca -q -c \
  "drop table if exists _ml_export; create table _ml_export (like public.snkrdunk_cards); \
   insert into _ml_export select * from public.snkrdunk_cards where species in ('lugia');"
docker exec pokeca-dev-db pg_dump -U pokeca -d pokeca --data-only --table=public._ml_export \
  --column-inserts --no-owner --no-privileges \
  | grep '^INSERT INTO' | sed 's/public\._ml_export/public.snkrdunk_cards/' \
  | sed 's/;$/ ON CONFLICT (source_id) DO NOTHING;/' \
  > infra/db/migrations/$(date +%Y%m%d_%H%M%S)_snkrdunk_seed_<종>.sql
docker exec pokeca-dev-db psql -U pokeca -d pokeca -q -c "drop table _ml_export;"
```

### 4. merge 재실행 마이그레이션 생성 (**새 파일명**)
`infra/db/migrations/20261107_snkrdunk_merge.sql`의 본문(세트 insert + gap-merge insert, 둘 다 멱등)을 그대로 복사해 새 날짜 파일명으로 저장. `20261108_150100_snkrdunk_merge_rerun.sql`가 복제 예시.

### 5. 로컬 적용 + 확인
```bash
node --import tsx --env-file-if-exists=.env.local scripts/db-migrate.mts   # 새 2개 적용
# cards 편입 확인
docker exec pokeca-dev-db psql -U pokeca -d pokeca -c \
  "select count(*) from public.cards where lang='ja' and name_ko like '루기아 %';"
# 검색 확인 (dev 서버 떠 있으면)
curl -s "http://localhost:3000/api/search?q=루기아&offset=0" | python3 -m json.tool | head
```

### 6. 상용 반영 (앱 코드 불변 = **데이터만**이면 deploy.sh 불필요)
```bash
export AWS_PROFILE=artpoke
# (a) 이미지 S3 (sync=신규만)
aws s3 sync .cache/snkrdunk-images/ s3://pokeca-uploads-138681986450/jp-cards/ \
  --content-type image/webp --no-progress
# (b) migrate Lambda: sql 스테이징 갱신 → 재배포 → invoke
cd infra
rm -rf lambda-migrate/sql && cp -R db/. lambda-migrate/sql/
(cd lambda-migrate && npm install --omit=dev)
terraform apply -target=aws_lambda_function.migrate -auto-approve
aws lambda invoke --function-name pokeca-migrate --region ap-northeast-1 \
  --cli-binary-format raw-in-base64-out /tmp/mig.json && cat /tmp/mig.json   # applied=[새 2개]
```
> SNKRDUNK 지원 코드(검색 union 아님 — merge로 cards 편입, `/api/jp-card-images` 라우트)가 **이미 상용 배포돼 있을 때만** deploy.sh 생략 가능. 코드가 바뀌면 `AWS_PROFILE=artpoke bash scripts/deploy.sh`도.

### 7. 상용 확인
```bash
BASE=https://d3mfru6qnveki4.cloudfront.net
curl -s "$BASE/api/search?q=루기아&offset=0" | python3 -m json.tool | head   # ja 카드 뜨는지
# 이미지: jp-card-images는 S3로 302 → -L로 최종 200 webp 확인
curl -sL -o /dev/null -w "%{http_code} %{content_type}\n" "$BASE/api/jp-card-images/<imagePath>"
```

## 커밋
`scripts/snkrdunk-targets.json` + 새 마이그레이션 2개를 커밋(영어 `feat:`). `lambda-migrate/sql/`는 gitignore(빌드 스테이징)라 커밋 안 함. git push 전 `gh` 계정이 `clyde-yoonjae`인지 확인.

## 흔한 실패

| 증상 | 원인 / 해결 |
|---|---|
| 크롤했는데 검색에 안 뜸 | merge 안 돌림 → 4·5단계(새 merge 마이그레이션). `cards`에 편입돼야 뜸 |
| 한글명으로 검색 안 됨 | `--pokemon`으로 크롤해 `species_ko`가 null → `--targets`(ko 포함)로 재크롤 |
| `npm run db:migrate` 깨짐 | node 20 + `.mts` → `node --import tsx ...` |
| 상용 migrate가 skip만 함 | 기존 파일명 재사용. 새 데이터는 **새 파일명** 마이그레이션이어야 적용됨 |
| `mew` 검색에 `뮤츠`가 섞임 | `%뮤%` substring이 `뮤츠`를 잡는 검색 노이즈(별개 이슈). 수집 자체는 `\bmew\b`로 정확 |
| jp 이미지 302 | 정상(로컬 .cache 없으면 S3로 리다이렉트). `-L`로 200 확인 |
