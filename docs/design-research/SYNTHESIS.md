# 디자인 레퍼런스 리서치 & 디자인시스템 설계

2026-10-30. ego-browser로 toss.tech · daangn.com · dcinside.com · teamblind.com을 데스크톱(1440)·모바일(390)로 캡처·데이터화한 결과와, 그로부터 도출한 **art-poke 디자인시스템(몬스터볼 테마)** 설계.

- 원본 캡처: `screenshots/*.png` (7장)
- 원본 데이터(computed styles, CSS 변수, breakpoint): `data/*.json` (7개)

---

## 1. 사이트별 요약 (데이터화)

### toss.tech — "클린 미니멀의 교과서"
- **폰트**: Toss Product Sans. 사이즈 13/15/16/17/20/32/36 (본문 15~16, 제목 20~36).
- **컬러**: 잉크 `rgb(3,18,40)` 계열 + 투명도(0.7 등)로 위계. 프라이머리 블루 `rgb(49,130,246)`.
- **radius**: 8 / 10 / 12 / 24 / 999(pill) / 50%. 버튼 10px.
- **버튼**: h40, padding 9/12, radius 10, weight 600.
- **CSS 변수 829개** (TDS 토큰 풀셋) — 토큰 기반 시스템의 끝판.
- **레이아웃**: 대형 히어로(좌측 볼드 헤드라인 + 우측 3D 일러스트) → 2컬럼(본문 리스트 + 우측 "인기 있는 글" 넘버드 랭킹 카드). 넉넉한 여백.
- **breakpoints**: 360/560/640/768/810/1024/1280. max-width 1024·1440.

### daangn.com — "검색-퍼스트 + 카테고리 타일 + 넘버드 리스트"
- **디자인시스템**: `carotene`. spacing 4px 스텝(.25rem~8rem = Tailwind와 동일), radius 4/8/12/16/20/24, static black/white + alpha.
- **폰트**: system(-apple-system). 사이즈 12/13/14/16/18/20.
- **컬러**: 캐롯 오렌지 `rgb(255,102,0)`. (다크모드 홈)
- **버튼**: h36, padding 8/14, radius 8, weight 700.
- **레이아웃**: 상단 풀폭 검색 pill → 카테고리 아이콘 타일 그리드(4열) → "🔥 지금 뜨는" 넘버드 리스트(썸네일 우측, 좋아요/댓글 메타) + 우측 서비스 컬럼. 모바일은 1컬럼 스택.
- **breakpoints**: 480/768/992/1200/1280/1440. 콘텐츠 컬럼 max-width 600.

### teamblind.com — "중앙 대형 검색 + 랭킹 리스트"
- **폰트**: **Pretendard** (우리 프로젝트가 이미 설치해 둔 폰트!).
- **컬러**: 프라이머리 **레드** `rgb(251,89,87)` (코랄 레드). radius 4.
- **버튼**: h40, radius 4, weight 600.
- **레이아웃**: 중앙 대형 검색 pill → "토픽 베스트" 리스트 + 우측 "실시간 인기 회사" 넘버드(1~10, 순위 변동 ▲▼N). 조밀한 텍스트 리스트. max-width 1140.
- **breakpoints**: 320/360/375/480/640/768/1024/1100/1580 (아주 촘촘한 반응형).

### dcinside.com — "고밀도 정보 포털" (밀도 레퍼런스)
- 12px tahoma, CSS 변수 0개, radius 거의 없음(30px 1곳). 순수 밀도·리스트 위주.
- **교훈**: 많은 리스트를 한 화면에 — 하지만 미학은 우리가 지양. "밀도가 필요한 리스트(검색결과·카드목록)"의 정보량 참고용.

---

## 2. 공통 패턴 (4개 사이트 교집합) → 우리 화면에 매핑

| 공통 패턴 | 우리 적용처 |
|---|---|
| **프라이머리 대형 검색바**(pill, 아이콘 내장) | 홈 히어로의 카드번호 검색 (후킹 핵심) |
| **넘버드 랭킹 리스트** (1~10, 썸네일+메타) | 홈 "인기 카드 / 최근 등록 도안" |
| **카테고리 아이콘 타일 그리드** | 규격 필터(9포켓/PSA/BRG)·세트 브라우즈 |
| **썸네일 우측 + 제목/메타/스탯 리스트 아이템** | 도안 리스트 / 검색결과 |
| **데스크톱 2컬럼(본문+사이드) → 모바일 1컬럼 스택** | 카드 상세·검색 페이지 |
| **토큰 기반(4px 스페이싱, 명확한 타입/radius 스케일)** | 우리 Tailwind 토큰 |

---

## 3. art-poke 디자인시스템 스펙 (몬스터볼 테마)

### 3.1 컨셉
**몬스터볼** = 레드(상단)·화이트(하단)·블랙(적도 밴드+테두리)·중앙 화이트 버튼. 
- **레드** = 프라이머리 액션/강조(검색 버튼, CTA, 활성 상태)
- **블랙** = 잉크(텍스트)·구조(헤더/푸터 밴드·테두리·실루엣)
- **화이트/그레이** = 서피스·배경·카드
- 로고/히어로에 몬스터볼 모티프(상단 레드 반원 + 중앙 밴드) 사용.

### 3.2 컬러 토큰
```
# Pokéball Red (primary)
red-50  #FFF2F0   red-100 #FFDDD6   red-200 #FFBBAD   red-300 #FF8E78
red-400 #FA5338   red-500 #EE1515  ← 시그니처(몬스터볼 레드)
red-600 #C81010   red-700 #A20D0D   red-800 #7C0B0B   red-900 #5A0909

# Ink / Black (몬스터볼 밴드 & 텍스트)
ink-900 #111113  ← 기본 텍스트   ink-800 #1D1D1F   ink-700 #2E2F33
ink-600 #4B4D52   ink-500 #6B6E76 (보조 텍스트)   ink-400 #9398A1

# Neutral / Surface (화이트 & 그레이)
white #FFFFFF   gray-50 #F8F9FA (앱 배경)   gray-100 #F1F3F5 (카드 배경)
gray-200 #E7EAEE (보더)   gray-300 #D3D8DF   gray-400 #AEB4BD

# Semantic
--background #FFFFFF   --foreground ink-900
--primary red-500   --primary-foreground #FFFFFF
--muted gray-100   --muted-foreground ink-500
--border gray-200   --ring red-500/40
--band ink-900 (몬스터볼 적도 밴드: 헤더 보더/구분선 강조에 절제 사용)
success #16A34A  warning #F59E0B  danger red-600
```
> 다크모드는 2차. (background ink-900, surface #1A1B1E, foreground gray-50, primary red-500 유지)

### 3.3 타이포 (Pretendard — 이미 설치됨, Blind와 동일 선택)
제목엔 Wanted Sans(설치됨) 옵션. 스케일(4px 리듬):
```
display 36/44 w700 · h1 28/36 w700 · h2 24/32 w700 · h3 20/28 w600
body-lg 18/28 w400 · body 16/24 w400 · body-sm 14/20 w400
caption 13/18 w400 · label 12/16 w600 (카드번호는 tabular-nums)
weight: 400 / 600 / 700
```

### 3.4 스페이싱 · radius · 그림자 · breakpoint
```
spacing: Tailwind 기본 4px 스케일 (daangn carotene과 동일) — 1=4 2=8 3=12 4=16 5=20 6=24 8=32 ...
radius:  sm 6 · md 8 · lg 12 · xl 16 · 2xl 24 · full 9999   (기본 버튼/인풋 10~12, 카드 16)
shadow:  xs 0 1 2 rgba(17,17,19,.06) · sm 0 2 8 rgba(17,17,19,.08) · md 0 8 24 rgba(17,17,19,.10)
         (토스식 아주 연한 그림자. 강한 그림자 지양)
breakpoints: sm 640 · md 768 · lg 1024 · xl 1280   (4개 사이트 교집합)
container: 본문 max-w 1120, 좁은 폼 max-w 640, 모바일 좌우 패딩 16·태블릿+ 24
터치 타깃: 최소 44px
```

### 3.5 버튼 스펙 (레퍼런스 종합: h40, r10~12, w600~700)
```
Button
  size: sm h36 px12 text-sm · md h44 px16 text-base · lg h52 px20 text-lg
  radius: 12 (lg 버튼은 12, pill 옵션 full)
  variant:
    primary   bg red-500  text white      hover red-600   (메인 CTA)
    secondary bg ink-900  text white       hover ink-800   (몬스터볼 블랙)
    outline   border gray-200 text ink-900 hover bg gray-50
    ghost     text ink-700 hover bg gray-100
    danger    bg red-600 text white
  weight 600
```

---

## 4. 컴포넌트 아키텍처 (shadcn 스타일 분리 + Storybook)

Atomic 계층. 모든 컴포넌트는 `components/ui/`에 shadcn식(복사-소유, cva variants)으로 두고 Storybook 스토리 1:1.

```
atoms      Button, Input, Badge, Avatar, Icon, Spinner, Skeleton, Chip, Divider, Kbd
molecules  SearchBar(히어로/헤더 2종), CardNumberBadge, FormatFilterTabs(세그먼트),
           ArtworkTile, RankItem(넘버드), ListItem(썸네일+메타), EmptyState, Toast, Dialog
organisms  Header(몬스터볼 로고+검색), Footer(밴드), ArtworkGrid, RankingList,
           CategoryTileGrid, CardHero(실루엣+메타), ArtworkViewer(크게보기)
templates  AppShell(헤더/푸터/컨테이너), TwoColumn(본문+사이드), CenteredForm
```
- 상태/variant는 **cva**로. 클래스는 **tailwind-merge(cn)**.
- 각 컴포넌트 `.stories.tsx`로 variant/size/state 카탈로그화 → Storybook.

## 5. 홈 화면 후킹 컨셉 (데스크톱→모바일)
1. **몬스터볼 히어로**: 상단 레드 그라데이션 반원 + 중앙 대형 검색바("카드 번호로 확장 아트 찾기", 예: sv2a 201/165). 토스 히어로 + 당근/블라인드 검색-퍼스트 결합.
2. **규격 타일**(9포켓/PSA/BRG) 아이콘 그리드 — 당근 카테고리 패턴.
3. **2컬럼**: 좌 "최근 등록 도안" 그리드 + 우 "인기 카드 TOP" 넘버드 랭킹(토스/블라인드).
4. 모바일: 히어로→타일→랭킹→그리드 1컬럼 스택.

## 6. 빌드 순서
1. Tailwind + shadcn 기반 셋업 (postcss, tailwind.config 토큰, globals, cn 유틸, cva)
2. Storybook 셋업
3. atoms → molecules → organisms 구현 + 스토리
4. 전 화면 리디자인(홈 먼저 → 검색/카드상세 → 작가 → 어드민)
5. 기존 CSS Modules 제거/이관
