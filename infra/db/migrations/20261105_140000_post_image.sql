-- 커뮤니티 게시글 이미지 첨부 컬럼. 기준선(01_app.sql 끝)에 같은 구문이 있지만, 기준선을 "기록만" 한 기존 DB에는 없을 수 있어 마이그레이션으로도 보장한다.
alter table public.posts add column if not exists image_path text;
