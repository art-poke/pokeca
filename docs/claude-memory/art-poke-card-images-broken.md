---
name: art-poke-card-images-broken
description: 공식 카드 이미지가 로컬·프로드 모두 404 — S3 버킷에 실제 파일이 없음
metadata: 
  node_type: memory
  type: project
  originSessionId: df3ce58b-227d-4641-9ced-4309f22d3198
---

`/api/card-images/{set}/{set}_{num}.webp`는 비공개 S3(pokeca-uploads) 서명 URL로 302 리다이렉트하는데, 실제 객체가 버킷에 없어 **로컬·프로드 모두 최종 404/403**. DB `cards.image_path`는 채워져 있어 `randomCardsWithImages`(image_path not null)는 행을 돌려주지만 `<img>`는 깨진다(naturalWidth 0). 즉 검색/카드 화면의 카드 그림이 현재 사이트 전체에서 안 뜬다.

**Why:** 공식 이미지 수집·S3 업로드 파이프라인이 WIP 상태(`feat/card-images` 3e453d7 "WIP")로, 업로드가 안 끝났거나 서명 URL에 `x-amz-checksum-mode=ENABLED`/`UNSIGNED-PAYLOAD`가 붙어 S3가 거부.

**How to apply:** 카드 그림이 꼭 떠야 하는 UI(예: 로그인 장식)는 실제 이미지에 의존하지 말 것. 로그인 화면 리뉴얼에선 몬스터볼 카드 뒷면(순수 Tailwind/SVG)으로 대체함(`app/artist/login/page.tsx`의 `CardShowcase`). 이미지가 필요하면 먼저 S3 업로드 파이프라인부터 고쳐야 함. [[art-poke-aws-migration]]
