# 카드 데이터

| 파일 | 내용 |
|---|---|
| `cards-kr.csv` | 한글판 카드 1,430장. 2023~2026년 스칼렛&바이올렛·MEGA 시리즈 47개 세트의 "기본 번호를 넘는 카드"(AR·SR·SAR·UR·MUR 등)와 일본판 별칭 1,357개. 2026-10-30 수집. |
| `cards-kr-alias-review.csv` | 일본판 별칭을 자동으로 붙이지 못한 73장과 이유. 사람이 확인할 목록. |

확장 아트는 기본 번호를 넘는 카드에 주로 만들어지므로 그 범위만 모았다. 세트 전체가 필요하면 `--all`로 다시 받는다.

## DB에 넣기

```bash
npm run cards:import -- data/cards-kr.csv          # 검사만(새로/갱신/별칭 개수)
npm run cards:import -- data/cards-kr.csv --apply  # 실제로 넣기
```

여러 번 넣어도 결과가 같다(세트 코드 + 번호로 갱신). 운영 DB는 출력 첫 줄 "대상"을 꼭 확인한다.

- 2026-10-30 로컬 DB에 넣어 확인했다: 카드 1,430장(시드의 2장은 갱신), 별칭 1,357개. "리자몽" 14장, "ボタン" 3장, `M2a 250/193`은 카드 페이지로 바로 간다. 운영 DB는 아직 없다.
- 넣으면 시드 카드 sv2a 201의 테스트용 영문 별칭(MEW 199/165)이 사라진다(별칭은 파일 내용으로 바뀐다). 테스트를 돌리기 전에는 `npm run db:reset`을 한다.

## 다시 만들기

```bash
# 1. 공식 한국 사이트에서 받기 (요청 간격 0.7초, 약 40분. --cache로 받은 HTML을 남기면 다시 돌릴 때 빠르다)
npm run cards:fetch -- --years 2023-2026 --cache .cache/kr --out /tmp/cards-kr.csv
#    한 세트만: --years 2023 --products 14   (BS2023014 = 포켓몬 카드 151)

# 2. 일본판 별칭 붙이기 (TCGdex 일본어 데이터)
npm run cards:aliases-ja -- --in /tmp/cards-kr.csv --out data/cards-kr.csv --cache .cache/ja

# 3. 검사 → 넣기
npm run cards:import -- data/cards-kr.csv
```

`.cache/`는 커밋하지 않는다.

## 출처와 알아 둘 점

**공식 한국 사이트** `https://pokemoncard.co.kr/cards/detail/BS{연도}{제품 3자리}{번호 3자리}` (`scripts/fetch-official-cards.mts`)
- 예: `BS2023014201` = SV2a 201/165 리자몽 ex SAR. robots.txt는 모두 허용. 그림·효과 문구는 가져오지 않고 세트·번호·이름·레어도·일러스트레이터·제품명만 쓴다.
- 세트 이름은 상세 페이지의 제품명 「…」 안쪽에서 가져온다(TCGdex 한국어 데이터에는 세트 이름이 거의 없다).
- **없는 번호·없는 제품도 HTTP 500을 낸다**(2026-10-30 저녁부터. 그 전에는 빈 200). 그래서 스크립트는 세트 중간의 500을 "세트 끝"으로 본다. 받는 도중 사이트가 잠깐 고장 나면 세트가 잘릴 수 있으니, 세트별 "가져옴 N장" 출력이 이상하면 그 세트만 다시 받는다.
- 시작 전에 SV2a 201을 읽어 사이트가 살아 있는지 확인한다. 사이트 전체가 오랫동안 500을 낸 적이 있다(2026-10-30 17:46~19:06).
- 덱 제품은 같은 번호가 여러 번 나와 한 줄로 합친다. 공식 데이터 자체에 오타가 있다(번호 `2 50 /193`, 일러스트레이터 철자 `Jiro Sasumo`/`Sasuno`).
- 2023-001(S12a, 소드실드)은 계속 500이라 빠졌다. 대상 시리즈가 아니라 문제없다.

**TCGdex** `https://api.tcgdex.net/v2/ja` (`scripts/add-ja-aliases.mts`)
- SV·MEGA 시리즈는 한글판과 일본판이 같은 세트 코드를 쓴다. 같은 번호의 일본판 카드를 찾아 **일러스트레이터까지 같을 때만** 별칭을 붙인다.
- 한글판은 트레이너스 카드를 가나다순으로 다시 매겨 번호가 어긋난다(한글 SV2a 196 남나리의 도움 = 일본 198 ナナミの手助け). 이때는 같은 세트에서 일러스트레이터가 같은 카드가 하나만 남을 때 그 번호로 붙인다(137장). 임의로 골라 11장을 이름으로 대조해 모두 맞았다.
- 일러스트레이터 비교는 대소문자·공백·악센트를 무시한다.
- TCGdex 일본어에 아직 없는 세트: SVI(배틀 아카데미), M6a(30th CELEBRATION), 덱·특별 세트 일부. 나중에 TCGdex에 들어오면 2번만 다시 돌린다(이미 붙은 별칭은 건너뛴다).

## 남은 일

- `cards-kr-alias-review.csv`의 73장 확인. 일본판 번호를 찾으면 `cards-kr.csv`의 `alias_set_code_ja, alias_number_ja, name_ja`를 채운다.
- 영문판 별칭(`alias_*_en`)은 아직 없다. 국제판은 세트 구성과 번호가 달라(151 = MEW) 자동 매칭 전에 규칙을 정해야 한다.
- 2023년 이전(소드실드 이전) 카드는 받지 않았다.

## 공식 카드 이미지

공식 한국 사이트의 카드 이미지(워터마크 webp, 868×1212)를 받아 S3 uploads 버킷 `cards/{세트}/{세트}_{번호}.webp`에 두고 `cards.image_path`에 기록한다. 카드 페이지는 `image_path`가 있으면 이미지를, 없으면 실루엣을 그린다(`/api/card-images/…`가 짧은 서명 URL로 302).

```bash
npm run cards:images -- --csv data/cards-kr.csv --out .cache/card-images --manifest data/card-images.csv   # 받기(0.7초 간격, 재실행 시 받은 건 건너뜀)
AWS_PROFILE=artpoke npm run cards:images:apply -- --manifest data/card-images.csv                          # S3 업로드 + DATABASE_URL의 cards.image_path 갱신
```

- 이미지 주소는 `/public-assets/home/data/cards.image_www/data/wmimages/{SV|MEGA}/{세트}/{세트}_{번호3자리}.webp` 로 세트·번호만으로 정해진다(HTML 수집 불필요). 세트 코드는 대소문자를 가리므로 CSV 원문 표기(SV2a, M2a)를 쓴다.
- 기본 에너지 카드처럼 번호가 글자(WAT, GRA…)인 카드는 이미지가 없다. 못 받은 카드는 manifest의 `status`(missing/error)로 남는다.
- 운영 DB는 `cards.image_path` 컬럼 추가(`infra/db/01_app.sql` 끝의 `20261105000000_card_images` 블록)를 먼저 적용한 뒤 같은 명령을 운영 `DATABASE_URL`로 돌린다.
- 규칙으로 못 정하는 카드는 `data/card-image-overrides.csv`(set_code,collector_number,source_url)에 적는다. 배틀 아카데미(SVI)는 같은 번호가 덱별 변형(_N/_G/_P)으로 갈려서 전부 여기 있다(공식 상세 페이지에서 뽑음).
- 2026-11-05 결과: 1,430장 중 1,423장 확보. 못 받은 7장 = 프로모 기본 에너지 5장(SVJL FIR, SVJP WAT, SVP2 GRA/LIG/PSY), SV11B 109/086(서버에 파일 없음, 403), M2a 250/193(공식 페이지 번호 오타 "2 50 /193", 이미지 없음).
