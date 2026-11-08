-- 회원 탈퇴(소프트) 마커.
-- 탈퇴 시 PII를 익명화(display_name='탈퇴한 작가', handle=null 등)하고 이 컬럼에 시각을 기록한다.
-- 작품(artworks.artist_id)은 유지돼 "탈퇴한 작가"로 표시된다. handle=null이라 공개 작가페이지·검색에서는 자동 제외.
alter table artists add column if not exists deleted_at timestamptz;
