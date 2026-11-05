-- 공식 카드 이미지(pokemoncard.co.kr 워터마크 webp)를 S3 uploads 버킷 cards/ 아래에 두고 경로를 기록한다.
-- null이면 카드 페이지는 기존 실루엣을 그린다. 경로 데이터는 다음 마이그레이션(…_card_images_data.sql)이 채운다.
alter table public.cards add column if not exists image_path text;
