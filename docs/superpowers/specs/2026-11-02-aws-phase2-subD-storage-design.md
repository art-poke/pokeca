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
클라: `components/admin/upload.ts` — export **`uploadFile(kind, file, api)`**(L20). 내부에서 `apiFetch(.../uploads)`로 createUpload 호출 후 Supabase SDK `storage.from(bucket).uploadToSignedUrl(...)` 수행. **재작성 대상은 `uploadFile`의 내부 업로드 호출.** (`uploadToSignedUrl`은 Supabase SDK 메서드지 앱 export 아님.) 현재 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`(L8)도 여기서 사용.
서브 C에서 `describe.skip`된 스토리지 결합 통합테스트 4개: artworks/consent-evidence/admin-actions/cleanup. `tests/helpers/fixtures.ts`(Supabase 업로드).

## 3. 목표 아키텍처
### 3.1 `lib/storage-client.ts` (재작성)
`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. 단일 `S3Client`(region ap-northeast-1; 로컬=profile/env 자격, 프로드=IAM 역할). export:
- `uploadUrl(bucket, key, contentType, {ttl}): Promise<string>` — presigned PUT URL(Content-Type 서명).
- `viewUrl(bucket, key, {download?, filename?, ttl}): Promise<string>` — presigned GET URL.
- `head(bucket, key): Promise<{size:number; contentType?:string}>` — `HeadObjectCommand`(크기/타입).
- `getRange(bucket, key, start, end): Promise<Uint8Array>` — `GetObjectCommand` + `Range: bytes=start-end`. **promote의 매직바이트 재검증용**(현 `readHead`가 `bytes=0-15`만 읽음 — 100MB 전체를 내려받지 않도록 반드시 ranged read). 필수.
- `putObject(bucket, key, bytes, contentType): Promise<void>` — 서버 생성물.
- `getObject(bucket, key): Promise<Uint8Array>` — 전체 다운로드(`readFile`용).
- `copy(bucket, from, to)`, `remove(bucket, keys[])`.

### 3.2 `lib/storage.ts` 재배선 (시그니처 유지)
- `createUpload` → `uploadUrl()`; 반환에 PUT url + key 포함(클라가 직접 PUT하도록). (현 반환 형태를 S3용으로 맞추되 호출부 영향 최소.)
- `promoteUpload`/`promoteEvidence`/`promoteAvatar`/`promoteReviewImage` → `head()`로 크기/타입 + `getRange(…,0,15)`로 **매직바이트 재검증** → `copy(pending→final)` → `remove(pending)` → (DB는 기존대로). ⚠️ **size ≤ MAX_BYTES 검증은 신규 동작**(현 promote는 크기 미검증, createUpload 사전체크에만 의존 — PUT은 S3가 용량 하드캡 안 하므로 promote가 유일 강제점). 전용 테스트 필요(§7 oversize).
- `storeGenerated` → `putObject`; `readFile` → `getObject`.
- `signedViewUrl`/`signedDownloadUrl`/`signedEvidenceUrl` → `viewUrl()`.
- `removeAvatar`/`removeFiles` → `remove()`.
### 3.3 클라 `components/admin/upload.ts` (`uploadFile`)
내부 Supabase `uploadToSignedUrl(...)` 호출을 → `fetch(uploadUrl, { method:"PUT", headers:{ "Content-Type": file.type }, body:file })`로 교체. createUpload(apiFetch)→PUT→promote 흐름은 유지. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`/Supabase 클라 import 제거.

### 3.4 인프라 (`infra/`, Terraform)
- 버킷 토폴로지 **확정 = 별도 버킷 2개**(현 코드가 `BUCKET`/`EVIDENCE_BUCKET`를 논리적 분리로 다루므로 변경 최소): `pokeca-uploads-138681986450`(**이미 있음** — `infra/s3.tf`, public-access-block ON, versioning ON) + `pokeca-consent-evidence-138681986450`(**신규 생성 필요** — 현재 infra에 없음). 둘 다 public access block ON.
- **CORS (신규)**: 현재 `infra/`에 CORS 없음 → 추가. 허용 Origin = localhost(dev) + (프로드 도메인은 서브 A), 메서드 PUT/GET.
- **Lifecycle (신규)**: 현재 없음 → `pending/` prefix 1일 후 자동삭제 추가.
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
- **Supabase 참조 전수**(리뷰 확인): 런타임=`lib/storage-client.ts`, `components/admin/upload.ts`. 테스트=`tests/helpers/fixtures.ts`(`SUPABASE_DB_URL`+storage+`PUBLISHABLE_KEY`), `tests/e2e/db.ts`(`SUPABASE_SECRET_KEY`+storage), `tests/e2e/artist.spec.ts`(Supabase `/auth/v1/signup` — **인증, 사실상 서브 C OAuth 빚**), `tests/integration/consent-evidence.test.ts:186`(skip 블록 내 anon 클라).
- env 제거: `NEXT_PUBLIC_SUPABASE_URL`·`SUPABASE_SECRET_KEY`·**`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`**·**`SUPABASE_DB_URL`**. ⚠️ `.env.example`↔`.env.local` **드리프트 reconcile**(현재 .env.local엔 있는데 .env.example엔 없는 키들 정리).
- `@supabase/supabase-js`(dep) + **`supabase` CLI(devDep)** 제거, `db:start`/`db:reset` 스크립트 제거(스토리지가 마지막 로컬-Supabase 의존 → 제거 후 로컬 Supabase 스택 불필요).
- `describe.skip` 해제: **파일 4개 / describe.skip 블록 10개**(artworks ×4, consent-evidence ×4, admin-actions ×1, cleanup ×1) + `consent-evidence.test.ts:186` anon 클라 이전. `tests/helpers/fixtures.ts` 업로드를 S3(presigned/putObject)로 이전.
- `tests/e2e/db.ts` 스토리지 호출 → S3로. `tests/e2e/artist.spec.ts` 소셜 signup 테스트는 **OAuth 콘솔 대기(서브 C 빚)라 skip 유지** — 이 블록된 e2e의 잔존 참조는 "완전 제거" 예외로 명시(DoD §9 참조).

## 7. 테스트
- **자격 전략 확정**: 로컬=**실 S3 dev**(전용 prefix `dev/` 또는 dev 버킷), `AWS_PROFILE=artpoke` 자격을 env로. 테스트도 동일(실 S3 dev prefix). LocalStack은 선택적 폴백(기본 아님). presigned 생성은 자격만 있으면 되고, 테스트는 자격 없으면 `describe.skip`(명시).
- `storage-client` 통합: `putObject→head→getRange(0,15)→getObject→copy→remove` 왕복, `uploadUrl` PUT 왕복, `viewUrl` GET.
- `promote` 검증 단위: oversize(>100MB, head size) 거부, 잘못된 content-type/매직바이트(getRange) 거부.
- skip 해제(4파일/10블록 + consent-evidence anon 이전)가 S3 대상으로 녹색.
- `npm run typecheck`·`npm run build` 녹색.

## 8. 리스크 / 함정
1. 로컬/테스트 presigned 생성 **AWS 자격** 필요 → **확정: 실 S3 dev prefix + `AWS_PROFILE=artpoke`**(§7). 자격 없는 환경은 해당 테스트 skip.
2. **CORS**: 브라우저 PUT 실패의 흔한 원인. Origin/헤더 정확히.
3. **consent-evidence 버킷**: 현재 infra에 **없음(확인됨)** → Terraform 신규 생성(§3.4).
4. presigned **Content-Type 불일치**(클라가 서명 때와 다른 헤더로 PUT하면 403).
5. 서브 A에서 CloudFront 붙일 때 서빙 URL을 CloudFront로 재전환해야 함(지금은 presigned GET).

## 9. 성공 기준 (DoD)
- [ ] 업로드/서빙/삭제가 전부 S3로 동작(로컬 실 S3 dev 검증).
- [ ] `lib/storage-client.ts`가 S3 SDK 기반, `lib/storage.ts` 시그니처 유지.
- [ ] 버킷 비공개+CORS+lifecycle+Lambda IAM Terraform 반영(`plan` 깨끗).
- [ ] `@supabase/*`(supabase-js + CLI) 및 Supabase env 제거 — **예외: `tests/e2e/artist.spec.ts` 소셜 signup은 OAuth 콘솔 대기로 skip 유지**(서브 C 빚). 그 외 런타임·테스트 Supabase 참조 0.
- [ ] skip 해제(4파일/10블록) S3 대상 녹색, `typecheck`/`build` 녹색.

## 10. 범위 밖
CloudFront/ACM/도메인(서브 A), 앱 배포(서브 A), 컷오버(서브 E).
