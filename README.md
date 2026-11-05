# 확장 아트 아카이브

카드 번호로 포켓몬 카드 확장 아트 도안을 찾는 비영리 아카이브. 설계는 `docs/designs/extended-art-archive-mvp.md`, 디자인 토큰은 `DESIGN.md`.

**처음이면 [`docs/HANDOFF.md`](docs/HANDOFF.md)부터 읽는다.** 지금 상태, PR 머지 순서, 다음 할 일, 배포 체크리스트, 함정이 있다. 화면 전체는 `docs/designs/screen-map/index.html`을 브라우저로 연다.

## 로컬 실행

필요: Node 22, Docker.

```bash
npm install
npm run db:start                 # 로컬 Supabase (마이그레이션·시드 자동 적용)
cp .env.example .env.local       # 값은 `npx supabase status -o env`에서 복사
npm run dev
npm run demo:seed                # (선택) 로컬 DB에 데모 도안 5개
```

도안은 모두 사이트에 보관한다. 원본(PNG·JPEG·PDF)을 올리면 서버가 PNG·JPEG에서 webp 미리보기를 만든다. PDF 원본은 미리보기 이미지를 같이 올린다.

## 테스트

테스트는 시드 데이터를 전제로 한다. 실제 카드 데이터를 넣은 DB라면 먼저 `npm run db:reset`을 한다.

```bash
npm test          # Vitest: 단위 + 로컬 Supabase 통합 테스트
npm run test:e2e  # Playwright: 데스크톱·모바일, axe 접근성 검사
```

GitHub Actions(`.github/workflows/test.yml`)가 push·PR마다 lint, 타입 검사, 두 테스트를 돌린다.

## 접근 규칙

- 모든 테이블은 RLS를 켜고 정책을 두지 않는다. 데이터는 서버에서 `lib/supabase/server.ts`의 `db()`로만 읽고 쓴다.
- 새 테이블이나 함수를 만들면 `tests/integration/access-boundary.test.ts`가 RLS 누락과 공개 실행 권한을 잡아낸다.

## 카드 넣기 (CSV)

```bash
npm run cards:import -- cards.csv          # 검사만: 몇 장이 새로 들어가고 갱신되는지 보여 준다
npm run cards:import -- cards.csv --apply  # 실제로 넣는다
```

- 컬럼: `set_code, collector_number, name_ko, rarity, illustrator, alias_set_code_ja, alias_number_ja, name_ja, alias_set_code_en, alias_number_en, name_en`. 앞의 셋만 필수이고 순서는 자유다.
- DB에 없는 세트는 `set_name_ko` 컬럼에 세트 이름을 같이 준다.
- 같은 카드(`set_code` + `collector_number`)는 갱신되고, 그 카드의 별칭은 파일 내용으로 바뀐다. 여러 번 돌려도 결과가 같다.
- 오류가 하나라도 있으면 줄 번호와 함께 보여 주고 아무것도 넣지 않는다.
- 대상 DB는 `DATABASE_URL`이다. 운영(RDS)에 넣을 때는 운영 URL을 주고 실행한다(출력 첫 줄의 "대상"을 확인).
- 실제 한글판 카드 목록은 `data/cards-kr.csv`(1,430장, 일본판 별칭 포함)에 있다. 공식 한국 사이트에서 다시 받는 방법(`npm run cards:fetch`, `npm run cards:aliases-ja`)은 [`data/README.md`](data/README.md).

## 어드민 계정 만들기

어드민은 이메일·비밀번호로 로그인한다. 계정은 아래 순서로 직접 만든다.

1. Supabase 대시보드 → Authentication → Users → "Add user"로 이메일·비밀번호 계정을 만든다(Email 제공자는 켜 둔다).
2. SQL 편집기에서 허용 목록에 넣는다: `insert into admins (user_id, email) select id, email from auth.users where email = '<이메일>';`
3. `/admin/login`으로 로그인한다.

## 작가 계정

- 작가 로그인은 카카오·구글뿐이다(`/artist/login`). 처음 로그인하면 작가 신청 폼(`/artist/signup`)으로 가고, 어드민 승인이 관문이다.
- 어드민이 `/admin/artists`에서 승인하면 작가가 `/artist/new`로 도안을 올리고, 올린 도안은 바로 카드 페이지와 작가 페이지(`/artists/<주소 이름>`)에 공개된다.
- 작가는 자기 도안을 카드 번호를 입력해 내릴 수 있다(철회, 파일 삭제). 숨김·복구는 어드민만 한다.
- "업로드 막기"(거절)는 새 업로드와 작가 페이지만 막는다. 이미 올린 작품은 어드민이 따로 숨긴다.
- 로컬 데모 작가: `npm run demo:seed` 뒤 작가 페이지 `/artists/byeolbit`.

### 카카오·구글 로그인 설정

소셜 로그인으로 계정이 생겨야 해서 Supabase의 "Allow new users to sign up"은 **켠다**. 계정만으로는 아무 권한이 없다(작가는 신청 + 승인, 어드민은 `admins` 허용 목록).

1. **카카오** ([developers.kakao.com](https://developers.kakao.com)): 애플리케이션 추가 → 카카오 로그인 켜기 → 앱 → 플랫폼 키 → REST API 키에 Redirect URI `https://<프로젝트>.supabase.co/auth/v1/callback` → 동의항목에서 닉네임(필수). REST API 키가 Client ID, 같은 화면의 카카오 로그인 클라이언트 시크릿이 Secret이다. **Supabase는 카카오에 이메일(account_email)을 항상 요청해서, 비즈 앱이 아니면 KOE205로 막힌다.** 앱 → 일반 → 비즈니스 정보에서 개인 개발자 비즈 앱으로 전환(본인인증, 무료)한 뒤 이메일 동의항목을 켜야 한다. 그래서 `config.toml`에서 카카오는 아직 꺼 두었다.
2. **구글** (Google Cloud Console → API 및 서비스 → 사용자 인증 정보): OAuth 클라이언트 ID(웹 애플리케이션) → 승인된 리디렉션 URI에 같은 Supabase 콜백 주소.
3. **Supabase 대시보드** → Authentication → Sign In / Providers에서 Kakao·Google을 켜고 키를 넣는다(Kakao는 "Allow users without an email" 켜기). URL Configuration의 Redirect URLs에 `https://<사이트>/artist/callback`을 넣는다.
4. 로컬에서 쓰려면 `.env.local`에 `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`·`_SECRET`(카카오는 `SUPABASE_AUTH_EXTERNAL_KAKAO_CLIENT_ID`·`_SECRET`)을 넣고 `npm run db:start`를 다시 한다. 구글은 `config.toml`에서 켜 두었다(키가 없어도 Supabase는 뜬다). 각 콘솔에는 로컬 콜백 `http://127.0.0.1:54321/auth/v1/callback`도 등록한다. 구글 동의 화면이 테스트 모드인 동안은 Google 인증 플랫폼 → 대상의 테스트 사용자만 로그인된다.

## 배포 환경 변수

`.env.example`의 값 전부. 특히 `CRON_SECRET`(정리 작업 인증)과 `REPORT_HASH_SECRET`(신고 IP 대역 해시)은 임의의 긴 문자열로 넣는다.

신고 알림 메일은 Resend로 보낸다. Resend에서 보내는 도메인을 인증하고 `RESEND_API_KEY`, `REPORT_NOTIFY_TO`(받는 주소), `REPORT_NOTIFY_FROM`(인증한 도메인의 주소)을 넣는다. 셋 중 하나라도 비면 메일 없이 서버 로그에만 남고, 신고 저장에는 영향이 없다.
