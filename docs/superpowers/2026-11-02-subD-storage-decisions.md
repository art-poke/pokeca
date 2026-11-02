# 서브 D(스토리지 이전) — 사전 결정·논의 기록

- 작성일: 2026-11-02 (서브 D 브레인스토밍 직전, 사용자와의 논의 결과)
- 목적: Supabase Storage → **S3 + CloudFront** 이전. 서브 C에서 격리해둔 `lib/storage-client.ts`를 교체 지점으로.
- 이 문서 = 브레인스토밍 입력. 아래 "확정"은 유지, "열린 결정"은 브레인스토밍에서 잠금.

## 확정된 것 (재논의 불필요)

1. **업로드 = 클라이언트 직접(presigned), 서버 프록시 아님.**
   - 이유: 배포가 Lambda(OpenNext) → **요청 바디 ~6MB 한계**. 작품 최대 `MAX_BYTES = 100MB`(`lib/storage.ts:23`). 파일이 우리 서버(Lambda)를 통과하는 서버-프록시 방식은 큰 파일에서 터짐.
   - 게다가 **현재 코드가 이미 클라-직접 방식**: 서버 `createSignedUploadUrl`(`lib/storage.ts:107`) → 클라 `uploadToSignedUrl`(`components/admin/upload.ts:34`). → S3 presigned가 1:1 매핑.
   - **서버 직접 업로드는 "서버가 생성한 작은 파일"(sharp 썸네일 등, `storeGenerated`)에만** 유지 — 이미 그렇게 돼 있음.

2. **업로드 흐름 3단계 (파일은 우리 서버를 절대 안 거침):**
   - ① 클라 → 우리 서버(인증 필수): "곧 올릴게"(메타만) → 서버가 **S3 presigned URL 문자열** 리턴. (작은 JSON이라 서버액션/라우트 OK)
   - ② 브라우저 `fetch(url, { method:"PUT", body:file })` → **S3에 직접 업로드**. (서버액션 불가 — 파일이 Lambda 통과하면 안 되므로 반드시 클라 fetch)
   - ③ 클라 → 우리 서버: "key=xxx 올렸음"(식별자 문자열만) → 서버가 검증 후 pending→final 이동 + DB 기록. (현 `promoteUpload`가 이 단계)

3. **보안 모델 (클라 직접의 리스크를 이렇게 막음):**
   - 버킷 **완전 비공개**. 서빙은 CloudFront(OAC) 또는 presigned GET. 업로드는 presigned PUT만.
   - presigned URL **짧은 만료**(60초~5분), URL 1개당 key 1개.
   - **key는 서버가 정함**(`pendingPath(uploadId)`), 클라가 임의 덮어쓰기 불가.
   - 발급 엔드포인트 **인증 필수**(requireArtist/requireAdmin).
   - **격리 후 승인**: `pending/` 접두사에 받고, ③ promote에서 서버가 **`HeadObject`로 실제 크기/타입 재검증** + `detectMime`(매직바이트) 스니핑 후 `final/`로. (현 코드의 pending→promote 구조와 일치)
   - CORS는 **우리 도메인으로만** 한정(`*` 금지).
   - 미승인 pending 쓰레기는 **S3 lifecycle(1일 자동삭제)** + rate limit.

## 열린 결정 (브레인스토밍에서 잠금)

- **(a) PUT+promote검증 vs POST+content-length-range**: 용량 상한을 S3가 엣지에서 하드 거부(POST policy)할지, PUT으로 두고 promote의 HeadObject 검증에 의존할지. (= 단순함 vs S3 레벨 강제. 보안 결정이기도 함.)
- **(b) 기존 Supabase 객체 이전 여부**: 런칭 전·실데이터 거의 없음 → 그냥 버리고 재업로드(미이전) 유력. 확인 필요.
- **(c) CloudFront 붙이는 시점**: 지금(서브 D) vs 서브 A(배포) 때. 서빙만 presigned GET로 먼저 가고 CloudFront는 A에서 붙일 수도.
- **(d) 서빙 방식**: CloudFront(OAC) vs presigned GET (작품 뷰/다운로드/아바타/증빙 각각).

## 코드 매핑 (교체 지점 = `lib/storage-client.ts` 한 곳)
- `createSignedUploadUrl` → S3 `getSignedUrl(PutObjectCommand)` (또는 `createPresignedPost`)
- 클라 `uploadToSignedUrl` → `fetch(url, {method:"PUT", body:file})`
- `createSignedUrl`(뷰/다운/증빙: `signedViewUrl`/`signedDownloadUrl`/`signedEvidenceUrl`) → `getSignedUrl(GetObjectCommand)` 또는 CloudFront 서명 URL
- `info` → `HeadObjectCommand`, `move`(pending→final) → Copy+Delete, `remove` → `DeleteObject(s)`, `upload`(서버 생성물) → `PutObjectCommand`, `download` → `GetObjectCommand`
- 버킷: 이미 있음 `pokeca-uploads-138681986450`(Phase 1). consent-evidence 버킷 처리도 포함.

## 서브 C에서 넘어온 정리 항목 (서브 D에서 같이 끝냄)
- `@supabase/supabase-js` + `NEXT_PUBLIC_SUPABASE_URL`·`SUPABASE_SECRET_KEY` env 제거.
- `describe.skip`된 스토리지 결합 통합테스트 4개(artworks/consent-evidence/admin-actions/cleanup) 해제.
- `tests/helpers/fixtures.ts`(Supabase 업로드) → S3/로컬로 이전. 시드 스크립트 스토리지 부분.
