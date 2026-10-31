import "server-only";
import { db } from "@/lib/supabase/server";
import { UUID } from "@/lib/uuid";

// 파일 경로 규칙과 업로드 확정 (eng D3, D4, D9).
//
//   [admin browser] ─1. createUpload ─> 서명 업로드 URL (pending/<uploadId>)
//   [admin browser] ─2. PUT 파일 ─> Supabase Storage (버킷이 100 MB·MIME 제한을 강제)
//   [server] promoteUpload(uploadId):
//       pending 있음 ─ 첫 16바이트 매직 바이트 확인 ─ 불일치 → pending 삭제, bad_file_type
//                    └ 일치 → artworks/<artworkId>/<kind>-<uploadId> 로 이동
//       pending 없음 + 대상 있음 → 이미 이동됨(재시도), 대상 정보 반환
//   정리 작업(cleanup): 24시간 지난 pending/, 행 없는 artworks/, 철회 작품 파일 재삭제
//
// 허락 근거(DM 캡처 등, 설계 R3)는 별도 비공개 버킷 consent-evidence에 같은 흐름으로 올린다.
//   pending/<uploadId> ─ promoteEvidence ─> artworks/<artworkId>/<uploadId>
// 이 버킷은 공개 라우트(다운로드·썸네일)가 쓰는 BUCKET과 섞지 않는다. 읽기는 어드민 라우트의
// signedEvidenceUrl만, 경로는 consent_events.evidence_path에 기록된 것만 쓴다.

export const BUCKET = "artworks";
export const MAX_BYTES = 100 * 1024 * 1024;
export const EVIDENCE_BUCKET = "consent-evidence";
const EVIDENCE_MAX_BYTES = 20 * 1024 * 1024;
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const EVIDENCE_TTL_SECONDS = 60;
const DOWNLOAD_TTL_SECONDS = 300;

export type FileKind = "original" | "thumbnail";
export type UploadKind = FileKind | "evidence" | "avatar" | "review";
export type MimeType = "image/png" | "image/jpeg" | "image/webp" | "application/pdf";

const ALLOWED: Record<UploadKind, MimeType[]> = {
  original: ["image/png", "image/jpeg", "application/pdf"],
  // 썸네일은 <img>로 보여 주므로 이미지 형식만.
  thumbnail: ["image/png", "image/jpeg"],
  evidence: ["image/png", "image/jpeg", "application/pdf"],
  // 프로필 이미지(회원)·후기 이미지. <img>로 보여 주므로 이미지만.
  avatar: ["image/png", "image/jpeg"],
  review: ["image/png", "image/jpeg"],
};

const bucketOf = (kind: UploadKind) => (kind === "evidence" ? EVIDENCE_BUCKET : BUCKET);
const maxBytesOf = (kind: UploadKind) =>
  kind === "evidence"
    ? EVIDENCE_MAX_BYTES
    : kind === "avatar" || kind === "review"
      ? AVATAR_MAX_BYTES
      : MAX_BYTES;

export const EXTENSION: Record<MimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export class StorageInputError extends Error {}


export function pendingPath(uploadId: string): string {
  if (!UUID.test(uploadId)) throw new StorageInputError("invalid_upload_id");
  return `pending/${uploadId}`;
}

export function finalPath(artworkId: string, kind: FileKind, uploadId: string): string {
  // 작품 ID가 경로에 그대로 들어가므로 UUID만 받는다(../ 경로, 정리 작업의 uuid 캐스트 실패 방지).
  if (!UUID.test(artworkId)) throw new StorageInputError("invalid_artwork_id");
  if (kind !== "original" && kind !== "thumbnail") throw new StorageInputError("invalid_kind");
  return `artworks/${artworkId}/${kind}-${uploadId}`;
}

export function evidencePath(artworkId: string, uploadId: string): string {
  if (!UUID.test(artworkId)) throw new StorageInputError("invalid_artwork_id");
  if (!UUID.test(uploadId)) throw new StorageInputError("invalid_upload_id");
  return `artworks/${artworkId}/${uploadId}`;
}

export function avatarPath(userId: string, uploadId: string): string {
  if (!UUID.test(userId)) throw new StorageInputError("invalid_user_id");
  if (!UUID.test(uploadId)) throw new StorageInputError("invalid_upload_id");
  return `avatars/${userId}/${uploadId}`;
}

export function reviewImagePath(uploadId: string): string {
  if (!UUID.test(uploadId)) throw new StorageInputError("invalid_upload_id");
  return `reviews/${uploadId}`;
}

export function detectMime(head: Uint8Array): MimeType | null {
  const starts = (sig: number[]) => sig.every((b, i) => head[i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}

export async function createUpload(input: { kind: UploadKind; mimeType: string; sizeBytes: number }) {
  if (!Object.hasOwn(ALLOWED, input.kind) || !ALLOWED[input.kind].includes(input.mimeType as MimeType)) {
    throw new StorageInputError("bad_file_type");
  }
  if (!(input.sizeBytes > 0 && input.sizeBytes <= maxBytesOf(input.kind))) {
    throw new StorageInputError("file_too_large");
  }
  const uploadId = crypto.randomUUID();
  const { data, error } = await db().storage.from(bucketOf(input.kind)).createSignedUploadUrl(pendingPath(uploadId));
  if (error) throw error;
  return { uploadId, path: data.path, token: data.token };
}

export type StoredFile = { kind: FileKind; path: string; mimeType: MimeType; sizeBytes: number };

async function readHead(bucket: string, path: string): Promise<Uint8Array> {
  const { data, error } = await db().storage.from(bucket).createSignedUrl(path, 60);
  if (error) throw error;
  // 최대 100 MB 파일을 통째로 받지 않고 앞부분만 읽는다.
  const res = await fetch(data.signedUrl, { headers: { Range: "bytes=0-15" } });
  if (!res.ok) throw new Error(`head read failed: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer()).slice(0, 16);
}

async function fileInfo(bucket: string, path: string) {
  const { data, error } = await db().storage.from(bucket).info(path);
  return error ? null : data;
}

// pending → 최종 경로. 매직 바이트가 허용 형식이 아니면 pending을 지우고 bad_file_type.
async function promote(kind: UploadKind, from: string, to: string) {
  const name = bucketOf(kind);
  const pending = await fileInfo(name, from);
  if (!pending) {
    const moved = await fileInfo(name, to);
    if (!moved) throw new StorageInputError("upload_missing");
    return { path: to, mimeType: moved.contentType as MimeType, sizeBytes: moved.size ?? 0 };
  }

  const mime = detectMime(await readHead(name, from));
  if (!mime || !ALLOWED[kind].includes(mime)) {
    await db().storage.from(name).remove([from]);
    throw new StorageInputError("bad_file_type");
  }

  const { error } = await db().storage.from(name).move(from, to);
  if (error) throw error;
  return { path: to, mimeType: mime, sizeBytes: pending.size ?? 0 };
}

export async function promoteUpload(uploadId: string, artworkId: string, kind: FileKind): Promise<StoredFile> {
  return { kind, ...(await promote(kind, pendingPath(uploadId), finalPath(artworkId, kind, uploadId))) };
}

// 서버가 만든 파일(원본에서 만든 미리보기)을 최종 경로에 바로 올린다. 업로드 ID 자리에는 새 UUID를 쓴다.
export async function storeGenerated(artworkId: string, kind: FileKind, bytes: Uint8Array, mimeType: MimeType): Promise<StoredFile> {
  const path = finalPath(artworkId, kind, crypto.randomUUID());
  const { error } = await db().storage.from(BUCKET).upload(path, bytes, { contentType: mimeType });
  if (error) throw error;
  return { kind, path, mimeType, sizeBytes: bytes.byteLength };
}

export async function readFile(path: string): Promise<Uint8Array> {
  const { data, error } = await db().storage.from(BUCKET).download(path);
  if (error) throw error;
  return new Uint8Array(await data.arrayBuffer());
}

// 허락 근거를 consent-evidence 버킷 안에서 확정한다. 반환값은 consent_events.evidence_path에 넣을 경로.
export async function promoteEvidence(uploadId: string, artworkId: string): Promise<string> {
  return (await promote("evidence", pendingPath(uploadId), evidencePath(artworkId, uploadId))).path;
}

// 프로필 이미지를 artworks 버킷 avatars/ 아래에 확정한다. 반환값은 members.avatar_path에 넣을 경로.
export async function promoteAvatar(uploadId: string, userId: string): Promise<string> {
  return (await promote("avatar", pendingPath(uploadId), avatarPath(userId, uploadId))).path;
}

// 후기 이미지를 artworks 버킷 reviews/ 아래에 확정한다. 반환값은 artist_reviews.image_path에 넣을 경로.
export async function promoteReviewImage(uploadId: string): Promise<string> {
  return (await promote("review", pendingPath(uploadId), reviewImagePath(uploadId))).path;
}

// 아바타 교체 시 옛 파일 정리(artwork_files 테이블과 무관하므로 저장소만 지운다).
export async function removeAvatar(path: string): Promise<void> {
  if (path) await db().storage.from(BUCKET).remove([path]);
}

// 어드민 전용(/api/admin/evidence). 공개 라우트에서 부르지 않는다.
export async function signedEvidenceUrl(path: string): Promise<string> {
  const { data, error } = await db().storage.from(EVIDENCE_BUCKET).createSignedUrl(path, EVIDENCE_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

export async function signedDownloadUrl(path: string, filename: string): Promise<string> {
  const { data, error } = await db()
    .storage.from(BUCKET)
    .createSignedUrl(path, DOWNLOAD_TTL_SECONDS, { download: filename });
  if (error) throw error;
  return data.signedUrl;
}

export async function signedViewUrl(path: string): Promise<string> {
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(path, DOWNLOAD_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

// 저장소에서 지운 뒤 DB에 반영한다. 실패하면 행이 남아 정리 작업이 다시 시도한다.
export async function removeFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await db().storage.from(BUCKET).remove(paths);
  if (error) throw error;
  const { error: dbError } = await db().rpc("artwork_files_removed", { p_paths: paths });
  if (dbError) throw dbError;
}
