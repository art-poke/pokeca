# SNKRDUNK 일어판 카드 카탈로그 — 수집·변환·배포 가이드

> 포켓몬 카드 리셀 플랫폼 **SNKRDUNK**에서 일어판 카드(메타 + 이미지)를 **포켓몬/트레이너 단위·인기순**으로 긁어, 우리 한글판 아카이브 검색에 통합한다.
> 누구나 이 문서만 보고 **그대로 긁고 → 변환하고 → 상용에 올릴 수 있게** 적었다.

---

## 0. 왜 / 무엇을

- **왜**: 한글판 DB(`cards`)는 최근 SV·메가 고레어 위주로 범위가 좁다. 일어판엔 **옛날 카드·프로모**가 많고, SV·메가는 **한/일 세트코드·번호가 동일**해 매칭된다. SNKRDUNK는 **목록에 세트코드+번호+레어도+세트명+가격+이미지가 정형으로** 다 있고(상세 방문 불필요), robots가 검색/카드 경로를 허용하며 rate limit이 널널하다. (KREAM은 번호가 없고 봇 차단이 빡빡해 탈락 — `docs/` 내 논의 참고.)
- **무엇을**: 별도 테이블 `snkrdunk_cards`에 적재(한글판 `cards` 오염 방지). 검색 시 `(set_code, collector_number)`로 조인해 **겹치면 한글판 우선**, 한글판에 없는 것만 "gap"으로 일어판 노출. *확장아트는 그림만 같으면 되므로 언어는 무관 → 같은 카드는 한 장으로 본다.*

### 관련 파일
| 파일 | 역할 |
|------|------|
| `scripts/snkrdunk-targets.json` | **수집 대상 목록**(영문 키워드 + 한글명, 인기순). 여기만 편집하면 됨 |
| `scripts/fetch-snkrdunk.mjs` | 크롤러(Playwright). 목록·파싱·이미지·DB 적재 |
| `scripts/reparse-snkrdunk.mjs` | 재크롤 없이 저장된 원문(raw_title)만 다시 파싱 |
| `infra/db/migrations/20261106_snkrdunk_catalog.sql` | 테이블 스키마 |
| `infra/db/migrations/20261106_snkrdunk_seed.sql` | 데이터 시드(상용 적재용, `--column-inserts`) |
| `lib/cards.ts` | 검색 UNION + dedup(`searchSnkrdunkGap`), 상세 폴백(`getSnkrdunkCard`) |
| `lib/card-image.ts` | 언어별 이미지 URL |
| `app/api/jp-card-images/[file]/route.ts` | 일어판 이미지 서빙(로컬 파일 → 없으면 S3 302) |

---

## 1. 대상 목록 편집 (`scripts/snkrdunk-targets.json`)

```json
{ "targets": [
  { "en": "mewtwo", "ko": "뮤츠" },
  { "en": "Cynthia", "ko": "시로나" },
  { "en": "Marnie", "ko": "마리" }
]}
```
- `en`: SNKRDUNK **영문 검색어**(`/en` 사이트 기준). 포켓몬/트레이너 이름.
- `ko`: **한글 검색용 이름**. null이면 한글 검색은 영문명으로만 잡힌다 → 되도록 채워라.
- **순서 = 인기순**(위부터 먼저 수집). 새 대상은 여기 추가.

## 2. 수집 (크롤)

```bash
# 목록(targets.json) 전체를 로컬 DB + 로컬 이미지로 수집
node --env-file=.env.local scripts/fetch-snkrdunk.mjs

# 특정 대상만 임시로
node --env-file=.env.local scripts/fetch-snkrdunk.mjs --pokemon charizard,pikachu

# 옵션
#   --maxpages N   포켓몬당 최대 페이지(기본 30, 페이지당 20장)
#   --delay ms     요청 간격(기본 1000, 예의상 낮추지 말 것)
#   --no-images    메타만
#   --images DIR   이미지 저장 폴더(기본 .cache/snkrdunk-images)
#   --headful      브라우저 띄워서 보기
```
- 재실행 안전: `source_id` 충돌 시 갱신, 받은 이미지는 건너뜀.
- 검색 목록(conversion=인기순)에서 바로 추출 → **상세 페이지 방문 안 함**.

### 파서가 처리하는 형식
- 일본판: `3MEGA Charizard X ex MA [M2a 223/193](High Class Pack "...")₩21,417~` → 대괄호=세트코드+번호
- 영문판: `Nessa U :Reverse Holo [157/185][EN](Sword & Shield "...")₩ -` → 대괄호=번호만, `[EN]` 마커
- 옛날/프로모: `Mewtwo LV.X [DP5]`, `[XY-P]` → 번호 없는 단일 세트코드
- **필터**: 검색이 fuzzy하므로 이름에 키워드가 **단어로** 들어간 카드만 둔다(`Bea`≠`Beast`). 미개봉 박스 등 세트코드 없는 건 제외.
- **인기순위**: 목록 앞 숫자는 "페이지 내 위치"라 못 쓰고, **수집 순서**로 매긴다.

## 3. 재파싱(선택) — 네트워크 없이 품질 보강

파서를 고친 뒤, 재크롤 없이 저장된 `raw_title`만 다시 파싱:
```bash
node --env-file=.env.local scripts/reparse-snkrdunk.mjs
```

## 4. 로컬 확인

```bash
npm run dev
# 카드검색에서 "뮤츠" / "시로나" / 번호 검색 → 일어판 카드가 JP 뱃지로 뜸
# 겹치는 한글판 카드는 한글판 우선(일어판 숨김)
```

---

## 5. 상용 배포

> 상용 RDS는 프라이빗이라 노트북에서 직접 못 붙는다. **마이그레이션 Lambda**가 VPC 안에서 `infra/lambda-migrate/sql/migrations/*.sql`를 적용한다. 그래서 스키마 + **데이터 시드**를 마이그레이션 파일로 넣는다.

1. **시드 생성**(로컬 데이터 → INSERT문). 컬럼명 포함(`--column-inserts`)이라 컬럼 순서 무관:
   ```bash
   docker exec pokeca-dev-db pg_dump -U pokeca -d pokeca \
     --data-only --table=public.snkrdunk_cards --column-inserts --no-owner --no-privileges \
     | grep '^INSERT INTO' | sed 's/;$/ ON CONFLICT (source_id) DO NOTHING;/' \
     > infra/db/migrations/20261106_snkrdunk_seed.sql
   # Lambda 복사본 동기화(정본=infra/db, Lambda=infra/lambda-migrate/sql)
   cp infra/db/migrations/20261106_snkrdunk_*.sql infra/lambda-migrate/sql/migrations/
   ```
   검증(빈 DB에 적용해 보기):
   ```bash
   docker exec pokeca-dev-db psql -U pokeca -d postgres -c "create database snkrtest;"
   docker exec -i pokeca-dev-db psql -U pokeca -d snkrtest < infra/db/migrations/20261106_snkrdunk_catalog.sql
   docker exec -i pokeca-dev-db psql -U pokeca -d snkrtest < infra/db/migrations/20261106_snkrdunk_seed.sql
   docker exec pokeca-dev-db psql -U pokeca -d snkrtest -c "select count(*) from snkrdunk_cards;"
   docker exec pokeca-dev-db psql -U pokeca -d postgres -c "drop database snkrtest;"
   ```

2. **이미지 → S3**(uploads 버킷 `jp-cards/`). **반드시 `AWS_PROFILE=artpoke`**(계정 138681986450):
   ```bash
   export AWS_PROFILE=artpoke
   aws s3 cp .cache/snkrdunk-images/ s3://pokeca-uploads-138681986450/jp-cards/ \
     --recursive --content-type image/webp --no-progress
   ```

3. **앱 배포 + 마이그레이션 적용**:
   ```bash
   AWS_PROFILE=artpoke bash scripts/deploy.sh      # 빌드·람다·S3·CloudFront
   AWS_PROFILE=artpoke aws lambda invoke --function-name pokeca-migrate /tmp/mig.json \
     && cat /tmp/mig.json                           # 마이그레이션(스키마+시드) 적용
   ```

4. **확인**: `https://d3mfru6qnveki4.cloudfront.net/search?q=뮤츠` → JP 카드가 뜨고 이미지가 열리면 성공.

### 새 포켓몬/트레이너 추가 레시피 (요약)
1. `scripts/snkrdunk-targets.json`에 `{en, ko}` 추가
2. `node --env-file=.env.local scripts/fetch-snkrdunk.mjs` (로컬 수집)
3. 위 **5-1 시드 재생성** → **5-2 이미지 업로드** → **5-3 배포+migrate**

---

## 6. 주의 (예의 / 저작권)

- **저속·캐시·robots 준수**: `--delay`를 낮추지 마라. `/en/v1` API는 robots 금지라 직접 치지 않고, robots가 허용하는 검색/카드 페이지를 렌더해서 쓴다.
- **ToS는 robots와 별개**다. 대량·상업적 사용은 피하고, 우리는 비영리 팬 아카이브로만 쓴다.
- 이미지·카드 디자인 저작권은 **포켓몬/닌텐도/크리처스/게임프리크**에 있다. 출처는 SNKRDUNK(배경제거 webp).
- 계정 분리: AWS는 반드시 `--profile artpoke`, git push 전 `gh` 계정이 `clyde-yoonjae`인지 확인.
