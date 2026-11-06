# 이미지 렌더링 전략 & `<AppImage>` 설계

> 작성: 2026-11-06. 상태: 설계(구현 전). 연관: `DESIGN.md`, `docs/superpowers/2026-11-04-subA-deploy-decisions.md`(배포·CloudFront), `art-poke-card-images-broken`(현재 이미지 404).

## 배경 / 문제

art-poke는 이미지 중심 서비스다(카드 아트, 작품 미리보기, 아바타, 커뮤니티·후기 사진). 그런데 현재:

- **19개의 raw `<img>` 가 13개 파일에 흩어져** 있고, 전달·렌더·로딩 전략이 각 태그 안에 뒤섞여 있다. 공유 컴포넌트가 없다.
- **스켈레톤·폴백이 없다.** 로딩 중엔 빈칸/레이아웃 시프트, 실패 시엔 브라우저 깨진-아이콘 + alt 텍스트가 노출된다.
- **최적화가 0이다.** 표시 이미지가 비공개 S3 + 서명 URL(302 리다이렉트)로 전달돼 `next/image` 옵티마이저를 못 쓴다(반응형/webp/lazy 없음). `components/card-tile.tsx`의 주석이 이 제약을 명시.
- 실제로 공식 카드 이미지는 S3 객체 부재로 사이트 전체 404 상태(별개 데이터 이슈, `art-poke-card-images-broken`).

## 목표 (우선순위: 넷 다)

1. **체감 UX** — 로딩 스켈레톤, 실패 시 우아한 폴백(깨짐·깜빡 없음), 레이아웃 시프트 제거(CLS=0).
2. **실제 성능·대역폭** — 반응형 크기(srcset) + webp/avif + lazy로 모바일 전송량 절감.
3. **신뢰성** — 일관된 폴백, 서명 URL 만료 재시도.
4. **개발 일관성** — 모두가 쓰는 단일 `<AppImage>` + 타입별 프리셋. 신규 화면도 자동으로 좋은 기본값.

## 비목표 (YAGNI)

- 공식 카드 이미지 파이프라인 복구(별개 작업).
- 클라이언트 업로드 리사이즈/크롭 에디터.
- 이 라운드에서 blurDataURL(LQIP) 전면 적용 — 선택 업그레이드로만 명시.

---

## 아키텍처: 3개 레이어로 분리

| 레이어 | 책임 | 담당 |
|---|---|---|
| ① 전달(Delivery) | 바이트가 어디서 어떻게 오나 | S3 + CloudFront |
| ② 렌더 컴포넌트 | 그리기 + 상태(로딩/로드/실패) | `<AppImage>` |
| ③ 로딩 전략 | 우선순위·지연·크기 선택 | priority / lazy / sizes |

핵심 원칙: **전달은 공개 CDN으로 안정화 → `next/image`가 최적화 엔진 → 그 위에 `<AppImage>`가 상태·폴백·프리셋을 입힘.**

---

## ① 전달 레이어 (결정: 표시 이미지 공개 CDN)

- **표시용 이미지**(카드 아트 · 작품 미리보기 · 아바타 · 커뮤니티/후기 사진) → **CloudFront 공개 경로**. 콘텐츠 해시 파일명 + `Cache-Control: public, max-age=31536000, immutable`.
- **다운로드 원본**(작가 고화질 파일) → 현행 유지: **비공개 S3 + 서명 URL**, 다운로드 액션에서만 발급.
- 근거: 표시 이미지는 이미 공개 페이지에 노출돼 있어 공개 CDN이 새로 유출하는 게 없다. 원본(유료/IP 핵심)만 게이팅하면 보안 요건 충족.
- **이것이 선행 조건**이다. CloudFront 공개 behavior + S3 공개 읽기(또는 OAC 공개 배포) 설정은 별도 인프라 작업(`infra/`). 이 전환 전에는 ② 컴포넌트가 raw `<img>` 폴백 모드로 동작(스켈레톤·폴백·lazy는 되지만 옵티마이저는 off).

### 현재 제약의 메커니즘 (왜 지금은 옵티마이저가 안 되나)

`next/image`는 `/_next/image?url=<소스>&w=640&q=75` 옵티마이저 엔드포인트(OpenNext image-optimization Lambda)를 가리킨다. 옵티마이저가 소스 url을 **서버에서 fetch → 리사이즈·재인코딩 → 캐시**한다. 현재 소스 `/api/card-images/...`는 **매번 새로 발급·단기 만료되는 서명 S3 URL로 302**한다 → 옵티마이저가 안정적으로 fetch 불가(302 추적·만료·`remotePatterns` 미등록). 공개 안정 URL로 바꾸면 해소된다.

---

## ②+③ 최적화 엔진: `next/image` 기본

표시 이미지가 공개되면 `next/image` 한 컴포넌트로 **srcset(반응형) + webp/avif + lazy + width/height 기반 CLS 방지**가 기본 제공된다. 인프라도 이미 준비돼 있다(OpenNext image fn + `/_next/image*` CloudFront behavior).

- `next.config.ts`의 `images.remotePatterns`에 CDN 호스트 등록.
- remote 이미지라 `placeholder="blur"`는 `blurDataURL`을 직접 줘야 함 → **기본 플레이스홀더는 스켈레톤**, blur는 선택 업그레이드.
- **대안(기록만)**: 업로드 때 `sharp`로 크기별 webp 변형본 pre-gen(이미 `lib/preview.ts`에서 sharp 사용). 1차는 `next/image` 옵티마이저(코드 최소·인프라 재활용). Lambda 호출 비용/지연이 문제되면 pre-gen으로 전환하되 **`<AppImage>` API는 불변, 뒤 엔진만 교체**.

---

## ② `<AppImage>` — 컴포넌트 설계

클라이언트 컴포넌트(`"use client"`). 상태 머신:

```
             onLoad
  loading ───────────► loaded   (이미지 opacity 0→1 페이드인, 스켈레톤 언마운트)
  (스켈레톤)
     │ onError
     └───────────────► error    (variant별 폴백 렌더)
```

### 구조

- 바깥을 `relative overflow-hidden` + `aspect-ratio` 박스로 감싼다 → **자리 선확보(CLS=0)**. (현 CardTile의 `aspect-[63/88]` 패턴을 전 타입으로 일반화.) `card`·`avatar`·`photo`는 프리셋 비율로 자동 확보되고, **`artwork`는 비율이 가변이라 호출부가 `aspectRatio`(또는 알고 있는 width/height)를 반드시 넘겨** 비율 없는 박스가 생기지 않게 한다.
- `loading && !error` 동안 `.skeleton` 쉬머를 `absolute inset-0`으로 깔아둠. (globals.css에 `@utility skeleton` 쉬머가 이미 있음 — 그대로 재사용. 현 CardTile은 `animate-pulse`를 쓰지만 `<AppImage>`는 `.skeleton`로 통일.)
- `state !== error`면 `next/image`를 `fill`로 렌더: `onLoad`→`loaded`, `onError`→`error`. 이미지는 `object-{cover|contain} transition-opacity`, loaded일 때만 `opacity-100`.
- `error`면 `<AppImageFallback variant=… />` 렌더.

### Props (초안)

| prop | 타입 | 기본 | 설명 |
|---|---|---|---|
| `src` | `string \| null \| undefined` | — | null/빈값이면 즉시 폴백 |
| `alt` | `string` | — | 필수 |
| `variant` | `"card" \| "avatar" \| "artwork" \| "photo"` | `"photo"` | 비율·`sizes`·폴백 모양 프리셋 |
| `sizes` | `string` | variant 기본 | 반응형 크기 힌트(override) |
| `priority` | `boolean` | `false` | 첫 화면 히어로/첫 줄만 true |
| `fit` | `"cover" \| "contain"` | `"cover"` | |
| `aspectRatio` | `string` | variant 기본 | override |
| `className` | `string` | — | 바깥 박스 |

### variant 프리셋

| variant | 기본 비율 | 폴백 | 기본 sizes(예) |
|---|---|---|---|
| `card` | `63/88` | 몬스터볼 + set/number 실루엣(CardTile 재사용) | `(max-width:640px) 45vw, (max-width:1024px) 30vw, 220px` |
| `avatar` | `1/1` | 이니셜 원형 | `48px` |
| `artwork` | 호출부 필수 지정 | 몬스터볼 워터마크 박스 | `(max-width:768px) 100vw, 720px` |
| `photo` | `4/3` | 몬스터볼 워터마크 박스 | `(max-width:768px) 100vw, 720px` |

### 폴백 컴포넌트

`AppImageFallback`: variant별 중립 플레이스홀더. **절대 브라우저 깨진-아이콘/alt 텍스트 노출 금지.** 색·여백은 DESIGN 토큰만(hex 금지). 카드 폴백은 기존 CardTile 폴백 로직을 추출·공유.

---

## ③ 로딩 전략

- **priority**: 첫 화면 히어로, 그리드 첫 줄(약 상위 N개)만 `priority` → 프리로드 + `fetchpriority=high`로 LCP 개선.
- **lazy**: 그 외 전부 기본 lazy. 뷰포트 근접 시 로드.
- **sizes**: variant 기본값 제공, 특수 레이아웃은 override. 브라우저가 `sizes`로 최소 충분 크기 변형을 선택.

---

## 신뢰성 / 에러 처리

- `onError` → variant 폴백. 재시도로 깜빡이지 않음(실제 onError에서만 전환).
- 공개 CDN 이미지는 만료 없음 → 단순 폴백.
- **서명 URL 경로(원본 다운로드)**만: 403 시 새 서명 URL 1회 재발급 후 재시도, 그래도 실패면 폴백. (다운로드 액션 한정, `<AppImage>` 표시 경로와 분리.)
- 느린 네트워크: 스켈레톤 유지(타임아웃으로 error 전환하지 않음).

---

## 적용 범위 / 롤아웃

1. **선행**: 전달 레이어(표시 이미지 공개 CDN) 인프라 전환. 미완료 시 `<AppImage>`는 raw `<img>` 폴백 모드.
2. `<AppImage>` + `AppImageFallback` + variant 프리셋 구현(`components/ui/`).
3. 19개 raw `<img>` → `<AppImage variant=…>` 점진 교체. CardTile의 기존 폴백/이미지 로직을 `<AppImage>`로 흡수.
4. Storybook 스토리로 3상태 카탈로그화.

교체 대상(13파일): `components/card-tile.tsx`, `components/card-image-zoom.tsx`, `components/ArtworkItem.tsx`, `components/artist-reviews.tsx`, `components/profile-edit.tsx`, `components/post-form.tsx`, `components/spec-info.tsx`, `components/admin/NewArtworkForm.tsx`, `app/ranking/page.tsx`, `app/community/[id]/page.tsx`, `app/community/reviews/page.tsx`, `app/artworks/[id]/page.tsx`, `app/artist/(studio)/StudioArtworks.tsx`, `domains/artwork/components/artwork-card.tsx`.

---

## 테스트

- **유닛**: `onLoad`/`onError` 시뮬레이션으로 상태 전이(loading→loaded, loading→error) + src null 즉시 폴백 검증.
- **Storybook**: variant별 loading/loaded/error 3상태 스토리.
- **회귀**: CLS(자리 선확보), 교체한 화면들 데스크톱 390/1280 스냅샷.

---

## 열린 질문

- 전달 레이어: S3 공개 읽기 vs CloudFront OAC로 공개 배포 — 인프라 서브태스크에서 결정.
- 콘텐츠 해시 파일명 적용 시점(업로드 파이프라인 변경 범위).
- blurDataURL(LQIP) 적용 대상 화면 선정(후속).
