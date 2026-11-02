# 서브 D — 스토리지 이전(Supabase Storage → S3) 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Supabase Object Storage 접근을 전부 S3로 바꾼다 — 업로드=클라 직접 presigned PUT + 서버 promote 검증, 서빙=presigned GET. 앱 호출부(`lib/storage.ts` 시그니처)는 유지, 교체는 `lib/storage-client.ts` 한 곳 + 업로드 응답 shape + Terraform.

**Architecture:** `lib/storage-client.ts`를 `@aws-sdk/client-s3`+`s3-request-presigner`로 재작성(논리버킷명→실 S3 버킷 매핑). `lib/storage.ts`는 새 클라이언트로 재배선(`createUpload`→presigned PUT URL 반환, `promote`→HeadObject 크기 + Range 매직바이트 검증 → copy+delete). 클라 `uploadFile`은 `fetch(PUT)`. CloudFront는 서브 A.

**Tech Stack:** Next 16, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, S3(ap-northeast-1), Terraform, vitest.

**브랜치:** `feat/aws-phase2-subD-storage` (이미 생성, 서브 C 위 스택). **AWS는 반드시 `--profile artpoke`(138681986450).** 스펙: `docs/superpowers/specs/2026-11-02-aws-phase2-subD-storage-design.md`.

---

## 파일 구조 (생성/수정)
- **수정** `lib/storage-client.ts` — Supabase→S3 SDK 전면 재작성. export: `uploadUrl/viewUrl/head/getRange/getObject/putObject/copy/remove/list` + 논리→실버킷 매핑. (`list`=테스트 fixtures용, 리뷰 반영.)
- **수정** `lib/storage.ts` — 각 함수 새 클라이언트로 재배선. `createUpload` 반환 shape 변경, `promote` 크기+매직 검증.
- **수정** `components/admin/upload.ts` — `uploadFile` 내부 업로드를 `fetch(PUT)`로. Supabase 클라/`PUBLISHABLE_KEY` 제거.
- **수정** `app/api/{admin,artist,member}/uploads/route.ts`(실제 경로 grep) — createUpload 새 응답(`{uploadId, uploadUrl}`) 전달.
- **수정** `infra/s3.tf` — consent-evidence 버킷(+public-access-block) 신규, 두 버킷 CORS·lifecycle 신규.
- **수정** `.env.example`/`.env.local` — Supabase 스토리지 env 제거, `S3_BUCKET_UPLOADS`/`S3_BUCKET_EVIDENCE`/`AWS_REGION` 추가, 로컬 자격(`AWS_PROFILE=artpoke`) 안내.
- **수정** 테스트: `tests/helpers/fixtures.ts`, `tests/e2e/db.ts`, skip 해제 4파일, `tests/integration/consent-evidence.test.ts`.
- **정리**: `@supabase/supabase-js`(dep)+`supabase`(devDep) 제거, `db:start`/`db:reset` 스크립트 제거.

---

## 스테이지 D0 — 인프라 + S3 클라이언트 토대

### Task 0.1: Terraform — consent-evidence 버킷 + CORS + lifecycle
**Files:** Modify `infra/s3.tf`
- [ ] **Step 1: 리소스 추가** (기존 uploads 버킷 블록 아래에)
```hcl
# 허락 근거 전용 비공개 버킷 (consent-evidence). uploads와 분리.
resource "aws_s3_bucket" "evidence" {
  bucket = "${var.project_name}-consent-evidence-${data.aws_caller_identity.current.account_id}"
}
resource "aws_s3_bucket_public_access_block" "evidence" {
  bucket                  = aws_s3_bucket.evidence.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_versioning" "evidence" {
  bucket = aws_s3_bucket.evidence.id
  versioning_configuration { status = "Enabled" }
}

# CORS — 브라우저 presigned PUT/GET 허용. dev=localhost, 프로드 도메인은 서브 A에서 추가.
locals {
  cors_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
}
resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  cors_rule {
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = local.cors_origins
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}
resource "aws_s3_bucket_cors_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id
  cors_rule {
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = local.cors_origins
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# pending/ 미승인 업로드 1일 후 자동 삭제.
resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    id     = "expire-pending"
    status = "Enabled"
    filter { prefix = "pending/" }
    expiration { days = 1 }
  }
}
resource "aws_s3_bucket_lifecycle_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id
  rule {
    id     = "expire-pending"
    status = "Enabled"
    filter { prefix = "pending/" }
    expiration { days = 1 }
  }
}
```
- [ ] **Step 2: 출력 추가** `infra/outputs.tf`에 버킷명(선택): `output "evidence_bucket" { value = aws_s3_bucket.evidence.bucket }`.
- [ ] **Step 3: plan+apply** (⚠️ 반드시 프로파일)
```bash
cd infra && AWS_PROFILE=artpoke terraform plan   # 신규 리소스만 추가 확인
AWS_PROFILE=artpoke terraform apply
AWS_PROFILE=artpoke terraform output             # uploads/evidence 버킷명 확보
```
Expected: evidence 버킷·CORS·lifecycle 생성, `plan` 그 외 No changes.
- [ ] **Step 4: 커밋** `git add infra/ && git commit -m "infra(s3): consent-evidence 버킷 + 두 버킷 CORS·lifecycle(서브 D)"`

### Task 0.2: env + 의존성
**Files:** Modify `.env.example`, `.env.local`, `package.json`
- [ ] **Step 1: SDK 설치** `npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
- [ ] **Step 2: `.env.example`** — 스토리지 Supabase 줄 제거, 추가:
```
# S3 스토리지 (서브 D). 버킷명은 terraform output. 로컬 자격은 AWS_PROFILE=artpoke.
AWS_REGION=ap-northeast-1
S3_BUCKET_UPLOADS=pokeca-uploads-138681986450
S3_BUCKET_EVIDENCE=pokeca-consent-evidence-138681986450
```
- [ ] **Step 3: `.env.local`** — 같은 값 + 로컬 자격. (SDK 기본 자격 체인이 `AWS_PROFILE`/`AWS_ACCESS_KEY_ID`를 읽음. 로컬 dev/test는 `AWS_PROFILE=artpoke`로 실행하거나 `.env.local`에 키. `.env.local` 커밋 금지.)
- [ ] **Step 4: 커밋** `git add .env.example package.json package-lock.json && git commit -m "feat(subD): aws-sdk/s3 설치 + S3 env"`

### Task 0.3: `lib/storage-client.ts` S3 재작성 (TDD)
**Files:** Rewrite `lib/storage-client.ts`, Test `tests/integration/storage-client.test.ts`
- [ ] **Step 1: 재작성**
```ts
import "server-only";
import {
  S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand,
  DeleteObjectsCommand, CopyObjectCommand, ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// 논리 버킷명(lib/storage.ts의 BUCKET/EVIDENCE_BUCKET) → 실제 S3 버킷.
const REAL: Record<string, string | undefined> = {
  artworks: process.env.S3_BUCKET_UPLOADS,
  "consent-evidence": process.env.S3_BUCKET_EVIDENCE,
};
const bucket = (logical: string): string => {
  const b = REAL[logical];
  if (!b) throw new Error(`unknown bucket: ${logical} (S3_BUCKET_* env 확인)`);
  return b;
};

const g = globalThis as unknown as { __s3?: S3Client };
const s3 = g.__s3 ?? new S3Client({ region: process.env.AWS_REGION ?? "ap-northeast-1" });
if (process.env.NODE_ENV !== "production") g.__s3 = s3;

export const uploadUrl = (logical: string, key: string, contentType: string, ttl = 300) =>
  getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket(logical), Key: key, ContentType: contentType }), { expiresIn: ttl });

export const viewUrl = (logical: string, key: string, opts: { download?: string; ttl?: number } = {}) =>
  getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket(logical), Key: key,
      ...(opts.download ? { ResponseContentDisposition: `attachment; filename="${opts.download}"` } : {}),
    }),
    { expiresIn: opts.ttl ?? 300 },
  );

export const head = async (logical: string, key: string): Promise<{ size: number; contentType?: string } | null> => {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: bucket(logical), Key: key }));
    return { size: r.ContentLength ?? 0, contentType: r.ContentType };
  } catch (e: unknown) {
    const code = (e as { name?: string; $metadata?: { httpStatusCode?: number } });
    if (code.name === "NotFound" || code.$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
};

export const getRange = async (logical: string, key: string, start: number, end: number): Promise<Uint8Array> => {
  const r = await s3.send(new GetObjectCommand({ Bucket: bucket(logical), Key: key, Range: `bytes=${start}-${end}` }));
  return r.Body!.transformToByteArray();
};

export const getObject = async (logical: string, key: string): Promise<Uint8Array> => {
  const r = await s3.send(new GetObjectCommand({ Bucket: bucket(logical), Key: key }));
  return r.Body!.transformToByteArray();
};

export const putObject = async (logical: string, key: string, bytes: Uint8Array, contentType: string): Promise<void> => {
  await s3.send(new PutObjectCommand({ Bucket: bucket(logical), Key: key, Body: bytes, ContentType: contentType }));
};

export const copy = async (logical: string, from: string, to: string): Promise<void> => {
  const b = bucket(logical);
  await s3.send(new CopyObjectCommand({ Bucket: b, CopySource: `${b}/${encodeURIComponent(from)}`, Key: to }));
};

export const remove = async (logical: string, keys: string[]): Promise<void> => {
  if (keys.length === 0) return;
  await s3.send(new DeleteObjectsCommand({ Bucket: bucket(logical), Delete: { Objects: keys.map((Key) => ({ Key })) } }));
};

// 테스트 fixtures/정리용 — prefix로 key 나열(페이지네이션). (Supabase storage.objects SELECT 대체)
export const list = async (logical: string, prefix: string): Promise<string[]> => {
  const out: string[] = [];
  let token: string | undefined;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: bucket(logical), Prefix: prefix, ContinuationToken: token }));
    for (const o of r.Contents ?? []) if (o.Key) out.push(o.Key);
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return out;
};
```
> **`list`는 fixtures의 `storedPaths()`/`evidencePaths()`/`resetArtworks()`와 e2e `clearArtworks()`가 쓰던 Supabase `select … from storage.objects`를 대체하는 핵심 프리미티브**(리뷰 지적). 반드시 포함.
- [ ] **Step 2: 통합 스모크 테스트** (실 S3 dev prefix; 자격 없으면 skip)
```ts
import { describe, it, expect, afterAll } from "vitest";
import { uploadUrl, viewUrl, head, getRange, getObject, putObject, copy, remove } from "@/lib/storage-client";

const run = process.env.S3_BUCKET_UPLOADS && (process.env.AWS_PROFILE || process.env.AWS_ACCESS_KEY_ID);
const d = run ? describe : describe.skip;
const key = (s: string) => `dev/test-${Date.now()}-${s}`;

d("storage-client (S3)", () => {
  const made: string[] = [];
  afterAll(async () => { if (made.length) await remove("artworks", made); });

  it("putObject→head→getRange→getObject→copy→remove 왕복", async () => {
    const png = new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a, 1,2,3,4,5,6,7,8]);
    const k = key("a"); made.push(k);
    await putObject("artworks", k, png, "image/png");
    const h = await head("artworks", k); expect(h?.size).toBe(16);
    const r = await getRange("artworks", k, 0, 7); expect(r[0]).toBe(0x89);
    const full = await getObject("artworks", k); expect(full.length).toBe(16);
    const k2 = key("b"); made.push(k2);
    await copy("artworks", k, k2); expect((await head("artworks", k2))?.size).toBe(16);
    await remove("artworks", [k]); expect(await head("artworks", k)).toBeNull();
  });

  it("uploadUrl PUT 왕복 + viewUrl GET", async () => {
    const k = key("c"); made.push(k);
    const put = await uploadUrl("artworks", k, "image/png");
    const png = new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
    const up = await fetch(put, { method: "PUT", headers: { "Content-Type": "image/png" }, body: png });
    expect(up.ok).toBe(true);
    const get = await viewUrl("artworks", k);
    const dl = await fetch(get); expect(dl.ok).toBe(true);
  });
});
```
- [ ] **Step 3: 실행** `AWS_PROFILE=artpoke S3_BUCKET_UPLOADS=... AWS_REGION=ap-northeast-1 npx vitest run tests/integration/storage-client.test.ts` → PASS (또는 자격 없으면 skip 확인).
- [ ] **Step 4: 커밋** `git add lib/storage-client.ts tests/integration/storage-client.test.ts && git commit -m "feat(subD): storage-client S3 재작성 + 왕복 스모크"`

**D0 DoD:** terraform apply 완료, `npm run typecheck` 녹색, 스모크 통과(자격 있으면).

---

## 스테이지 D1 — storage.ts 재배선 + 클라 업로드 + 라우트

### Task 1.1: `lib/storage.ts` 재배선
**Files:** Modify `lib/storage.ts`
- [ ] **Step 1: import 교체** — `storageClient` import 제거, 새 함수 import:
```ts
import { uploadUrl, viewUrl, head, getRange, getObject, putObject, copy, remove } from "@/lib/storage-client";
```
- [ ] **Step 2: `createUpload`** (반환 shape 변경 — 라우트/클라와 함께)
```ts
export async function createUpload(input: { kind: UploadKind; mimeType: string; sizeBytes: number }) {
  if (!Object.hasOwn(ALLOWED, input.kind) || !ALLOWED[input.kind].includes(input.mimeType as MimeType)) {
    throw new StorageInputError("bad_file_type");
  }
  if (!(input.sizeBytes > 0 && input.sizeBytes <= maxBytesOf(input.kind))) {
    throw new StorageInputError("file_too_large");
  }
  const uploadId = crypto.randomUUID();
  const key = pendingPath(uploadId);
  const url = await uploadUrl(bucketOf(input.kind), key, input.mimeType);
  return { uploadId, key, uploadUrl: url };
}
```
- [ ] **Step 3: `readHead` 삭제, `fileInfo`→`head`, `promote` 재작성** (크기 검증 신규 + 매직 getRange + move=copy+delete)
```ts
async function promote(kind: UploadKind, from: string, to: string) {
  const name = bucketOf(kind);
  const pending = await head(name, from);
  if (!pending) {
    const moved = await head(name, to);
    if (!moved) throw new StorageInputError("upload_missing");
    return { path: to, mimeType: moved.contentType as MimeType, sizeBytes: moved.size };
  }
  // 신규: 실제 크기 강제(PUT은 S3가 용량 하드캡 안 하므로 여기가 유일 강제점).
  if (pending.size > maxBytesOf(kind)) {
    await remove(name, [from]);
    throw new StorageInputError("file_too_large");
  }
  const mime = detectMime(await getRange(name, from, 0, 15));
  if (!mime || !ALLOWED[kind].includes(mime)) {
    await remove(name, [from]);
    throw new StorageInputError("bad_file_type");
  }
  await copy(name, from, to);
  await remove(name, [from]);
  return { path: to, mimeType: mime, sizeBytes: pending.size };
}
```
- [ ] **Step 4: 나머지 함수** — `storeGenerated`→`putObject(BUCKET, path, bytes, mimeType)`; `readFile`→`getObject(BUCKET, path)`; `signedEvidenceUrl`→`viewUrl(EVIDENCE_BUCKET, path, { ttl: EVIDENCE_TTL_SECONDS })`; `signedDownloadUrl`→`viewUrl(BUCKET, path, { download: filename, ttl: DOWNLOAD_TTL_SECONDS })`; `signedViewUrl`→`viewUrl(BUCKET, path, { ttl: DOWNLOAD_TTL_SECONDS })`; `removeAvatar`/`removeFiles`→`remove(BUCKET, [...])`. (`removeFiles`의 `artwork_files_removed` rpc 호출은 그대로.)
- [ ] **Step 5: 타입체크** `npm run typecheck`
- [ ] **Step 6: 커밋** `git commit -am "feat(subD): storage.ts를 S3 클라이언트로 재배선(createUpload presigned, promote head+range)"`

### Task 1.2: 업로드 라우트 응답 shape
**Files:** `app/api/{admin,artist,member}/uploads/route.ts` (grep: `grep -rl "createUpload" app`)
- [ ] **Step 1:** 각 라우트가 `createUpload(...)` 결과를 반환하는지 확인. 반환 JSON이 `{ uploadId, uploadUrl }`(+key 필요시)를 담도록. (기존 `{ path, token, uploadId }` 소비처는 클라 `uploadFile`뿐 → 1.3에서 맞춤.)
- [ ] **Step 2: 타입체크** + **커밋** `git commit -am "feat(subD): uploads 라우트 응답을 presigned URL로"`

### Task 1.3: 클라 `uploadFile`
**Files:** Modify `components/admin/upload.ts`
- [ ] **Step 1:** Supabase `createClient`/`storage`/`PUBLISHABLE_KEY` 제거. `uploadFile` 교체:
```ts
export async function uploadFile(kind, file, api = "/api/admin"): Promise<string> {
  const body = await apiFetch<{ uploadId: string; uploadUrl: string }>(`${api}/uploads`, {
    method: "POST",
    body: JSON.stringify({ kind, mimeType: file.type, sizeBytes: file.size }),
  });
  const res = await fetch(body.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!res.ok) throw new Error("upload_failed");
  return body.uploadId;
}
```
(타입 시그니처·UPLOAD_ERRORS·errorMessage 유지.)
- [ ] **Step 2: 타입체크/빌드** `npm run typecheck && npm run build`
- [ ] **Step 3: 커밋** `git commit -am "feat(subD): 클라 uploadFile을 presigned PUT fetch로(Supabase 제거)"`

**D1 DoD:** typecheck+build 녹색. (수동: `npm run dev`+`AWS_PROFILE=artpoke`로 어드민 업로드 1회 — 선택, 자격 있을 때.)

---

## 스테이지 D2 — 테스트 해제 + Supabase 완전 제거

### Task 2.1: promote 검증 단위 테스트
**Files:** `tests/integration/storage-promote.test.ts` (실 S3 dev; 자격 없으면 skip)
- [ ] oversize(>maxBytesOf) → `file_too_large` + pending 삭제 확인; 잘못된 매직바이트 → `bad_file_type` + pending 삭제; 정상 → copy+delete 후 final에 존재. 커밋.

### Task 2.2: fixtures + e2e 스토리지 이전
**Files:** `tests/helpers/fixtures.ts`, `tests/e2e/db.ts`
> ⚠️ 리뷰 지적: 이 헬퍼들은 Supabase 전용 Postgres 테이블 `storage.objects`를 `select name from storage.objects where bucket_id=...`로 조회한다(S3엔 없음). `storage-client`의 새 **`list(logical, prefix)`** 로 재작성.
- [ ] **Step 1 `fixtures.ts`:**
  - `uploadAsBrowser`(또는 업로드 헬퍼) → `putObject(logical, key, bytes, contentType)`.
  - `storedPaths()`(line 47) → **`list("artworks", "")` (전체 버킷 — `pending/`도 포함해야 함: `cleanup.test.ts:95`가 `toEqual(['pending/${upload}'])` 단언. 좁은 `artworks/` prefix로 하면 깨짐)**, `evidencePaths()`(line 57) → `list("consent-evidence", "")`, `resetArtworks()`(line 63) → `list("artworks","")` 후 `remove(...)`. 기존 SQL `order by name`과 맞게 반환 정렬(S3 lexicographic = 동일). 하드 단언(`toEqual`/`startsWith('artworks/${id}/')`/`['pending/${upload}']`) 통과하도록 반환 형태 유지.
  - `postgres()` 연결 `SUPABASE_DB_URL`(line 6) → **`DATABASE_URL`**(테스트 DB 연결, 스토리지 아님 — 빠뜨리지 말 것). `PUBLISHABLE_KEY`/Supabase import 제거.
- [ ] **Step 2 `tests/e2e/db.ts`:** Playwright(순수 node)라 **`lib/storage-client`(server-only) import 불가** → 테스트 파일 안에서 `@aws-sdk/client-s3`를 **직접 인스턴스화**. `storage.objects`(line 61)·`.upload`(50)·`.remove`(62) → 직접 S3 `PutObject`/`ListObjectsV2`/`DeleteObjects`. `SUPABASE_SECRET_KEY` 제거.
- [ ] **Step 3: 타입체크 + 커밋.**

### Task 2.3: skip 해제 (4파일/10블록) + 잔존 storageClient 호출 포팅
**Files:** `tests/integration/{artworks,consent-evidence,admin-actions,cleanup}.test.ts`
> ⚠️ 리뷰 지적: 이 파일들엔 `storageClient().from(...).upload()/download()` 직접 호출이 남아 있는데(0.3에서 `storageClient` 삭제됨) 안 고치면 **컴파일 실패**.
- [ ] **Step 1: 잔존 호출 포팅** — `artworks.test.ts:108` `.download` → `getObject`; `cleanup.test.ts:42,71` `.upload` → `putObject`; `consent-evidence.test.ts:145` `.upload` → `putObject`; `consent-evidence.test.ts:186` anon Supabase 클라 → S3/`getObject`. (전부 `@/lib/storage-client`의 새 export 사용.)
- [ ] **Step 2: skip 해제** — 각 `describe.skip`→`describe`(10블록).
- [ ] **Step 3: 실행** — 실 S3 dev 대상 녹색(`AWS_PROFILE=artpoke`). 자격 없으면 해당 파일 상단 `describe.skip` 유지 + `// AWS 자격 필요(서브 D)` 주석.
- [ ] **Step 4: 커밋.**

### Task 2.4: Supabase 완전 제거
**Files:** `package.json`, `.env.example`, `.env.local`
- [ ] `npm rm @supabase/supabase-js supabase`; `db:start`/`db:reset` 스크립트 제거; `.env`에서 `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SECRET_KEY`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_DB_URL` 제거(.env.example↔.env.local reconcile).
- [ ] 잔재 grep: `grep -rn 'supabase' lib app components tests --include=*.ts --include=*.tsx` → **런타임 0**, 테스트도 0 (예외: `tests/e2e/artist.spec.ts` 소셜 signup = OAuth 콘솔 대기 skip, 주석으로 명시). 커밋.

### Task 2.5: 최종 검증
- [ ] `npm run typecheck` 녹색, `npm test` 녹색(자격 있을 때 S3 테스트 포함; 없으면 해당 skip 명시), `npm run build` 녹색.
- [ ] 핸드오프 `docs/superpowers/NEXT-SESSION-phase2.md` 갱신(서브 D 완료, 서브 A에서 CloudFront+프로드 CORS+Lambda IAM 추가 필요 명시).

**D2 DoD = 서브 D DoD(스펙 §9):** 업로드/서빙/삭제 S3 동작, `@supabase/*` 제거(e2e 소셜 예외), skip 해제 녹색, typecheck/test/build 녹색, terraform plan 깨끗.

---

## 위험 체크 (실행 중)
1. **CORS 403**: 브라우저 PUT 실패 시 버킷 CORS Origin/메서드 확인(0.1).
2. **presigned Content-Type 불일치**: 서명(`uploadUrl`의 ContentType)과 PUT 헤더(`file.type`)가 같아야 함 — 다르면 403.
3. **CopySource 인코딩**: key에 특수문자 시 `encodeURIComponent` 필수(이미 반영).
4. **자격**: 로컬/테스트는 `AWS_PROFILE=artpoke`. Lambda(프로드)는 IAM 역할 — **서브 A에서 app Lambda role에 S3 권한 부여**(이 플랜은 버킷/CORS/lifecycle까지, Lambda IAM은 sub A).
5. **버킷명 env**: `S3_BUCKET_*` 미설정 시 `bucket()`이 즉시 throw(명시적 실패).
6. **getRange 응답**: `transformToByteArray()`는 node SDK v3 제공(서버 전용 — storage.ts가 server-only라 OK).

## 범위 밖
CloudFront(OAC)+ACM+도메인·프로드 CORS·Lambda S3 IAM(서브 A), 앱 배포(A), 컷오버(E).
