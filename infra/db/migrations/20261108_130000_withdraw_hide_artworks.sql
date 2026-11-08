-- 과거 탈퇴자(artists.deleted_at NOT NULL)의 남은 공개 작품을 내린다.
-- 탈퇴 시 작품 내림(withdrawMyAccount) 추가 이전에 탈퇴한 계정의 작품이 active/hidden으로
-- 남아 랭킹·카드상세·검색카운트에 노출되는 것을 일괄 정리한다. 멱등.
update public.artworks w
   set status = 'withdrawn'
  from public.artists a
 where w.artist_id = a.user_id
   and a.deleted_at is not null
   and w.status in ('active', 'hidden');
