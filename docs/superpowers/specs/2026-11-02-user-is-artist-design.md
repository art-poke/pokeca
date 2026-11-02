# 설계: 유저=작가 (member/artist 단일화) — 승인됨, 구현 대기

- 작성일: 2026-11-02 (브레인스토밍 승인 완료, 구현은 추후)
- 배경: 현재는 소셜 유저(member)가 `/artist/signup`에서 **작가 신청 → 어드민 승인(pending/approved)** 해야 도안 업로드 가능. member/artist 2테이블 + 승인 플로우가 복잡. 사용자 요청: **"유저가 곧 작가. 누구나 작가. 신청/승인 없음. 정보는 마이페이지에서 입력."**

## 확정 결정 (브레인스토밍)
| # | 항목 | 결정 |
|---|---|---|
| 1 | 데이터 모델 | **단일 프로필 테이블**(members+artists 합침). 이름 `artists` 유지(공개 URL `/artists/[handle]`·용어 churn 최소), `members` 흡수·삭제 |
| 2 | 승인 | **작가 승인 완전 제거**(status/reviewed_* 제거, 어드민 '작가 관리' 페이지·`reviewArtist` 제거). **작품 모더레이션(신고/숨김/철회)은 유지** |
| 3 | 프로필/handle | 로그인 시 프로필 자동생성(display_name 기본값). **업로드(발행) 전 마이페이지에서 display_name+handle 필수 설정**(옛 승인 게이트 대체) |
| 4 | UX | **마이페이지 통합**: 옛 `/me`(프로필) + `/artist` 스튜디오(내 도안/통계/업로드) → 하나. '작가 스튜디오' 별도 메뉴 제거 |

## 데이터 모델 (단일 `artists` = 프로필)
- `user_id`(PK→users), `display_name`(not null, 자동 기본값), `avatar_path`(null, members에서 흡수), `handle`(unique, **null 허용** — 발행 전 없음), `intro`(null), `link_url`(null), `provider`, `created_at`
- **제거**: `status`, `reviewed_at`, `reviewed_by`, `members` 테이블
- 첫 상호작용 시 프로필 자동생성(현 members 자동생성 로직 흡수). handle은 발행 시 채움.

## 게이트
- `requireArtist`(승인작가) → **`requireProfile`**(로그인) / **`requirePublisher`**(handle+display_name 있음=발행가능).
- 업로드/발행 = `requirePublisher`. handle 없으면 마이페이지로 1회 유도.
- 댓글·커뮤니티·즐겨찾기·추천 = 로그인만.

## 제거/수정 대상 (현 코드)
- 삭제: `app/artist/signup`, `app/admin/(console)/artists`, `reviewArtist`(admin actions), `registerArtist`/`requireApplicant`/`setArtistStatus`/`anyApprovedArtist`.
- `status === "approved"` 게이팅 전수 → "handle 있으면 공개"로: `lib/artists.ts`(getPortfolio/approvedArtistId/searchArtists/listArtists), `lib/ranking.ts:83`, `lib/artworks.ts:313`, `lib/artist-route.ts:11`, `lib/reviews.ts:75`.
- `lib/members.ts` → `lib/artists.ts`(프로필)로 흡수, 마이페이지 편집으로.
- `app/me` + `app/artist/(studio)` → 통합 마이페이지.

## 유지
- artworks + 상태(active/hidden/withdrawn) + 모더레이션/신고, 카드/검색/커뮤니티/즐겨찾기/후기. `artworks.artist_id → users.id`.

## 마이그레이션
- 런칭 전·데이터 없음 → `infra/db/*.sql` + `lib/db/schema.ts` 재정의. 유저 이전 불필요.

## DoD
- 단일 프로필, 승인 제거, requirePublisher 게이트, 통합 마이페이지, 공개페이지 handle 기반. 모더레이션 유지. typecheck/test/build 녹색.

## 범위 밖 / 메모
- 어드민 유저 차단 기능(악용 대비)은 YAGNI로 제외(필요 시 후속).
- 이 설계는 **승인됨**. 구현은 `/gstack` writing-plans로 플랜 짜서 진행(아직 미착수).
