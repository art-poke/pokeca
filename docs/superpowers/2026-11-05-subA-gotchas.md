# 서브 A 배포 — 운영 주의 & 삽질 기록 (다시 안 하려고)

> 2026-11-04~05 배포하며 실제로 막혔던 것들. 다음에 같은 삽질 반복 안 하도록 원인+해결+검증법을 남긴다.
> 연관: `2026-11-04-subA-deploy-decisions.md`(ADR), `NEXT-SESSION-phase2.md`.

---

## 1. CloudFront → Lambda 연결: Function URL은 막다른 길 (→ API Gateway)
세 번 벽에 부딪힘(상세는 ADR-A14·A15):
- **OAC+Function URL(IAM)**: GET은 되는데 **POST(서버액션/API)가 403**. CloudFront OAC가 POST body 해시(x-amz-content-sha256)를 서명 못 함. Lambda는 unsigned payload 거부.
- **auth=NONE 공개 Function URL**: **artpoke 신규계정이 정책 무관하게 403 차단**(healthcheck 공개 URL도 동일). 인수인계 "공개 Function URL 403: 신규계정 제한" 실제 확인.
- **OAC+Lambda 권한**: `lambda:InvokeFunctionUrl` 외 **`lambda:InvokeFunction`도 필요**(없으면 GET도 403).
- **결론**: **API Gateway HTTP API(v2) → Lambda proxy**로 전환. payload v2가 OpenNext와 동일 포맷, POST 네이티브, 신규계정 제약 없음. (`infra/api.tf`)
- **교훈**: 다음부터 OpenNext on AWS는 **처음부터 API Gateway**로 가라. Function URL+OAC는 GET-only + 신규계정에서 삽질.

## 2. OpenNext 빌드 함정
- **sharp**: 앱이 `lib/preview.ts`에서 `import sharp` → OpenNext가 external 처리해 server fn에 안 넣음 → **SSR 전부 500**("Failed to load external module sharp"). `open-next.config.ts`의 `default.install`로 `sharp@0.35.5`(x64/linux/glibc) 설치. (ADR-A12)
- **archive_file 금지**: OpenNext 번들에 심볼릭 링크(깨진 것 포함) 있어 Terraform `data.archive_file`가 실패. **`zip -ry`로 압축** + pre-built zip 참조(`filebase64sha256`). `scripts/deploy.sh`가 담당.
- **dummy 캐시**: 전동적 앱이라 `incrementalCache/queue/tagCache: "dummy"`로 Dynamo/SQS/cache버킷 생략. 안 끄면 런타임이 그것들을 기대. (ADR-A6)
- **버전**: OpenNext 4.1.15 peer `next>=16.4.5` → Next 16.4.3→16.4.5 범프 필요. (ADR-A11)
- **빌드 정본 확인**: `open-next.output.json`의 `streaming`/`origins`/`behaviors`가 정답. CloudFront behaviors는 이걸 그대로 매핑.

## 3. RDS SSL 필수
- 앱 Lambda DB 쿼리 전부 `no pg_hba.conf entry ... no encryption` → **홈 200인데 빈 shell**(쿼리 실패 조용히 삼킴 → "DB 렌더 OK" 오탐 주의!).
- `DATABASE_URL`에 **`?sslmode=no-verify`**. 로컬 Docker PG는 불필요. (ADR-A16)

## 4. x-forwarded-host (Auth.js 콜백 도메인)
- CloudFront→Lambda면 Lambda가 받는 Host가 틀려서 Auth.js 콜백/세션이 깨짐. **CloudFront viewer-request Function으로 `x-forwarded-host` 주입** + Lambda env `AUTH_TRUST_HOST=true`. Host는 origin으로 forward 금지. (ADR-A7)

## 5. ★ 카카오 Redirect URI (KOE006) — 가장 오래 삽질
- **새 콘솔(2026) 위치**: `카카오 로그인 → 일반`에는 **Redirect URI 섹션이 없다**(사용설정·OpenID Connect만). 실제 위치는 **앱 → 플랫폼 키 → REST API 키 카드 → "로그인 리다이렉트 URI" 칩 → REST API 키 수정** 페이지.
- **함정(핵심)**: 그 수정 페이지에 리다이렉트 URI 입력이 **두 섹션**:
  - **"카카오 로그인 리다이렉트 URI"** ← OAuth 로그인용 (여기 넣어야 함)
  - **"비즈니스 인증 리다이렉트 URI"** ← 다른 용도
  - 둘 다 placeholder가 `예: https://example.com/oauth`라 **잘못된 섹션에 넣기 쉬움**. 비즈니스 인증에 넣으면 콘솔엔 저장돼 보여도 **카카오 로그인 OAuth는 KOE006**(등록 안 된 redirect URI).
- **자동화 함정**: JS로 input.value 주입 + input 이벤트만으론 **카카오 React 폼 상태에 안 잡혀 저장 payload에서 누락**(화면엔 보이는데 실제 저장 안 됨). **실제 키보드 타이핑**(page.mouse.click + keyboard.type) 필수. 칸 추가는 각 섹션의 `aria-label="입력 필드 추가"` 버튼(localhost 입력과 같은 행).
- **검증법(앱 세션 불필요, 빠름)**: 카카오 authorize를 직접 쳐서 KOE006 여부 확인:
  ```
  https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=57bd70a97973368479a1a3d0f1b71fed&redirect_uri=https%3A%2F%2Fd3mfru6qnveki4.cloudfront.net%2Fapi%2Fauth%2Fcallback%2Fkakao
  ```
  - KOE006 → 미등록(섹션 확인). 로그인/동의 화면 → 수락됨. (수동 authorize는 state가 없어 콜백에서 "Configuration" 뜨는데 그건 정상 — KOE006만 아니면 됨.)
- 카카오는 변경이 OAuth 서버에 반영되는 데 수 분 걸릴 수 있음(단, 이번 KOE006은 전파가 아니라 섹션 오류였음).

## 6. ★ OAuth 콘솔 자동화 일반 교훈
- **ego로 Material/React 콘솔(구글·카카오) 조작 시 JS value 주입 금지 → 실제 키보드 타이핑.** 저장 버튼은 텍스트("저장") 못 찾으면 좌표 클릭. 저장 후 **재조회가 아니라 "진짜 동작"(authorize/로그인)으로 검증**(폼 재조회는 draft 때문에 오탐).
- 콘솔 로그인은 사용자 세션 필요(비번 대신 사용자가 로그인). 제어권 handoff/takeover 주의.

## 7. 알려진 미해결 버그 (후속)
- **프로덕션 signout이 세션을 안 지운다**: `/api/auth/signout` POST 후에도 `/api/auth/session`에 유저 남음. 로그인·세션읽기는 정상, 로그아웃만. 
  - 가설: Auth.js **청크된 세션 쿠키**(큰 JWT가 `authjs.session-token.0/.1`로 쪼개짐)를 지울 때 **다중 Set-Cookie가 CloudFront/API Gateway를 거치며 일부만 전달**. 또는 쿠키 속성(Secure/Host prefix) 불일치.
  - 조사 시작점: 로그인 응답 vs 로그아웃 응답의 Set-Cookie 개수/이름 비교(브라우저 네트워크), API Gateway payload v2의 `cookies` 배열 처리, OpenNext의 multi Set-Cookie 핸들링.
  - 영향: 공용 PC에서 로그아웃 안 됨(보안). 우선순위 중.

## 빠른 검증 체크리스트 (배포 후)
```bash
D=https://d3mfru6qnveki4.cloudfront.net
curl -s -o /dev/null -w "home=%{http_code}\n" "$D/"              # 200
curl -s -w "session=%{http_code}\n" -o /dev/null "$D/api/auth/session"  # 200 (null)
curl -s -X POST -o /dev/null -w "POST=%{http_code}\n" "$D/api/events" -d '{}'  # 400(앱도달), 403이면 오리진 문제
# 카카오 redirect: 위 authorize URL로 KOE006 여부
# terraform: cd infra && AWS_PROFILE=artpoke terraform plan  → No changes
```

## 8. ★ 프로드 업로드 전부 막힘 — S3 CORS에 cloudfront origin 누락 (2026-11-05 발견)
- 증상: 프로드에서 아바타·후기·커뮤니티 글 이미지·도안 업로드가 **조용히 실패**(앱 로그 없음, 폼 그대로). 브라우저 presigned PUT이 S3 CORS에 막힘.
- 원인: `infra/s3.tf`의 `cors_origins`가 localhost만. (서브 D 핸드오프의 "서브 A가 프로드 CORS origin 추가" 항목 누락.)
- 해결: `cors_origins`에 `https://d3mfru6qnveki4.cloudfront.net` 추가 → apply. 커스텀 도메인 붙이면 거기도 추가.
- 교훈: 브라우저 직접 업로드(presigned)는 **S3 CORS에 실제 서빙 origin**이 있어야 함. 업로드 디버깅 시 앱 로그 없으면 CORS 의심(클라 측 실패).
