# AWS 이전 Phase 2 — 서브 D 설계: 스토리지 이전 (Supabase Storage → S3)

- 작성일: 2026-11-02
- 사전 논의/결정: `docs/superpowers/2026-11-02-subD-storage-decisions.md`
- 상위: `2026-11-01-aws-phase2-design.md`. 선행: 서브 C(인증+데이터 Drizzle) 완료(브랜치 `feat/aws-phase2-subC-auth`, PR #1).
- 작업 브랜치: `feat/aws-phase2-subD-storage` (서브 C 위에 스택).
- AWS: **반드시 `--profile artpoke`(계정 138681986450)**.

## 0. 한 줄 요약
Supabase Object Storage → **S3**. 서브 C에서 격리해둔 `lib/storage-client.ts` 한 곳을 S3 SDK로 교체. 업로드=**클라 직접 presigned PUT + 서버 promote 검증**, 서빙=**presigned GET**(CloudFront는 서브 A). 앱 호출부(`lib/storage.ts` 시그니처)는 유지.

## 1. 확정 결정
| # | 항목 | 결정 |
|---|---|---|
| D-1 | 업로드 | **presigned PUT**(클라 직접) + promote에서 서버 검증. 서버 프록시 금지(Lambda 6MB·작품 100MB). |
| D-2 | 서빙 | **presigned GET**(현 signedViewUrl/DownloadUrl/EvidenceUrl와 1:1). **CloudFront(OAC)+도메인+ACM은 서브 A**. |
| D-3 | 기존 객체 | **이전 안 함**(런칭 전). 재업로드/`npm run demo`. |
| D-4 | 로컬 테스트 | **실 S3 dev**(전용 prefix, `--profile artpoke` 자격 env). Lambda(프로드)=IAM 역할. |
| D-5 | 서버 직접 업로드 | 서버 생성물(sharp 썸네일 `storeGenerated`)만 `PutObject`. 사용자 업로드는 전부 presigned. |

## 2. 현재 상태 (교체 대상)
`lib/storage-client.ts` — 현재 얇은 **Supabase storage** 래퍼(`storageClient()`), 서브 C에서 격리됨. 유일한 Supabase 스토리지 접점.
`lib/storage.ts` — 호출부(시그니처 유지 대상):
- 상수: `BUCKET="artworks"`, `EVIDENCE_BUCKET="consent-evidence"`, `MAX_BYTES=100MB`, `EXTENSION`/`detectMime`(매직바이트).
- 경로: `pendingPath`/`finalPath`/`evidencePath`/`avatarPath`/`reviewImagePath`.
- 업로드: `createUpload`(→ 현 `createSignedUploadUrl`), `promoteUpload`/`promoteEvidence`/`promoteAvatar`/`promoteReviewImage`(pending→final `move`+`info`), `storeGenerated`(`upload` 서버생성), `readFile`(`download`).
- 서빙: `signedViewUrl`/`signedDownloadUrl`/`signedEvidenceUrl`(→ 현 `createSignedUrl`).
- 삭제: `removeAvatar`/`removeFiles`(→ `remove`).
클라: `components/admin/upload.ts` — 현 `uploadToSignedUrl(path, token, file)`.
서브 C에서 `describe.skip`된 스토리지 결합 통합테스트 4개: artworks/consent-evidence/admin-actions/cleanup. `tests/helpers/fixtures.ts`(Supabase 업로드).

## 3. 목표 아키텍처
### 3.1 `lib/storage-client.ts` (재작성)
`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. 단일 `S3Client`(region ap-northeast-1; 로컬=profile/env 자격, 프로드=IAM 역할). export:
- `uploadUrl(bucket, key, contentType, {ttl}): Promise<string>` — presigned PUT URL(Content-Type 서명).
- `viewUrl(bucket, key, {download?, filename?, ttl}): Promise<string>` — presigned GET URL.
- `head(bucket, key): Promise<{size:number; contentType?:string}>` — `HeadObjectCommand`.
- `putObject(bucket, key, bytes, contentType): Promise<void>` — 서버 생성물.
- `getObject(bucket, key): Promise<Uint8Array>`.
- `copy(bucket, from, to)`, `remove(bucket, keys[])`.

### 3.2 `lib/storage.ts` 재배선 (시그니처 유지)
- `createUpload` → `uploadUrl()`; 반환에 PUT url + key 포함(클라가 직접 PUT하도록). (현 반환 형태를 S3용으로 맞추되 호출부 영향 최소.)
- `promoteUpload`/`promoteEvidence`/`promoteAvatar`/`promoteReviewImage` → `head()`로 **size ≤ MAX_BYTES + content-type/매직바이트 재검증** → `copy(pending→final)` → `remove(pending)` → (DB는 기존대로).
- `storeGenerated` → `putObject`; `readFile` → `getObject`.
- `signedViewUrl`/`signedDownloadUrl`/`signedEvidenceUrl` → `viewUrl()`.
- `removeAvatar`/`removeFiles` → `remove()`.
### 3.3 클라 `components/admin/upload.ts`
`uploadToSignedUrl(...)` → `fetch(uploadUrl, { method:"PUT", headers:{ "Content-Type": file.type }, body:file })`. 성공 후 promote 호출(기존 흐름 유지).

### 3.4 인프라 (`infra/`, Terraform)
- 버킷: `pokeca-uploads-138681986450`(있음), `consent-evidence`(없으면 생성). 둘 다 **public access block ON**.
- **CORS**: 허용 Origin = localhost(dev) + (프로드 도메인은 서브 A), 메서드 PUT/GET, 필요한 헤더.
- **Lifecycle**: `pending/` prefix 1일 후 자동삭제.
- **IAM**: Lambda 실행역할에 두 버킷 `s3:PutObject/GetObject/DeleteObject/HeadObject`(+presigned 생성은 자격만 있으면 됨).
- CloudFront/ACM/도메인 = **서브 A**(범위 밖).

## 4. 데이터 흐름 (업로드)
① 클라 → `createUpload`(인증 필수): 서버가 key(`pendingPath(uploadId)`) 정하고 presigned PUT URL 반환.
② 브라우저 `fetch(PUT, file)` → **S3 직접**(pending/). (서버액션 아님)
③ 클라 → `promoteUpload(uploadId, …)`: 서버가 `head`로 검증 → copy pending→final → remove pending → DB 기록 → 최종 key/ok.
서빙: `viewUrl(final key)` presigned GET (뷰/다운/증빙).

## 5. 보안
비공개 버킷 + presigned 짧은 TTL(업로드 60~300s, 뷰 짧게) + key는 서버 결정 + 발급 인증 필수(requireArtist/Admin) + pending→promote 격리검증(head size/type + 매직바이트) + CORS Origin 한정 + lifecycle GC + rate limit(기존). 서명에 Content-Type 포함.

## 6. 서브 C 빚 정리 (서브 D에서 끝냄)
- `@supabase/supabase-js` 제거, `NEXT_PUBLIC_SUPABASE_URL`·`SUPABASE_SECRET_KEY` env 제거, `.env.example`/`.env.local` 정리.
- `describe.skip` 통합테스트 4개 **해제** + `tests/helpers/fixtures.ts`를 S3(presigned/putObject)로 이전.
- `supabase start`/`db:start`/`db:reset` 스크립트 등 Supabase 로컬 스택 의존 정리(스토리지가 마지막 의존이었음 → 로컬 Supabase 불필요해짐).

## 7. 테스트
- `storage-client` 통합(실 S3 dev prefix 또는 LocalStack): `putObject→head→getObject→copy→remove` 왕복, `uploadUrl` PUT 왕복, `viewUrl` GET.
- `promote` 검증 단위: oversize(>100MB) 거부, 잘못된 content-type/매직바이트 거부.
- skip 해제한 4개 통합테스트가 S3 대상으로 녹색.
- `npm run typecheck`·`npm run build` 녹색.

## 8. 리스크 / 함정
1. 로컬 presigned 생성 **AWS 자격** 필요(실 S3 선택 → `AWS_PROFILE=artpoke` 또는 env). CI/테스트 자격 전략 확정.
2. **CORS**: 브라우저 PUT 실패의 흔한 원인. Origin/헤더 정확히.
3. **consent-evidence 버킷** Phase1에 없을 수 있음 → Terraform 추가.
4. presigned **Content-Type 불일치**(클라가 서명 때와 다른 헤더로 PUT하면 403).
5. 서브 A에서 CloudFront 붙일 때 서빙 URL을 CloudFront로 재전환해야 함(지금은 presigned GET).

## 9. 성공 기준 (DoD)
- [ ] 업로드/서빙/삭제가 전부 S3로 동작(로컬 실 S3 dev 검증).
- [ ] `lib/storage-client.ts`가 S3 SDK 기반, `lib/storage.ts` 시그니처 유지.
- [ ] 버킷 비공개+CORS+lifecycle+Lambda IAM Terraform 반영(`plan` 깨끗).
- [ ] `@supabase/*` 완전 제거, skip 테스트 4개 해제·녹색, typecheck/build 녹색.

## 10. 범위 밖
CloudFront/ACM/도메인(서브 A), 앱 배포(서브 A), 컷오버(서브 E).
