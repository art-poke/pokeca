import postgres from "postgres";
import sharp from "sharp";
import { createUpload, type UploadKind } from "@/lib/storage";
import { list, putObject, remove } from "@/lib/storage-client";

export const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {} });

// createUpload의 논리 버킷명(lib/storage.ts와 동일). evidence만 consent-evidence로 간다.
const logicalBucket = (kind: UploadKind) => (kind === "evidence" ? "consent-evidence" : "artworks");

export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3, 4]);
export const PDF = new TextEncoder().encode("%PDF-1.7\n%test\n");
export const FAKE_PNG = new TextEncoder().encode("this is not a png at all");
// 미리보기를 만들 수 있는 진짜 이미지(반투명 PNG, 2000×2800 → 미리보기 최대 1600px로 줄어든다).
export const ART_PNG = new Uint8Array(
  await sharp({ create: { width: 2000, height: 2800, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 0.5 } } })
    .png()
    .toBuffer(),
);

// 브라우저 업로드(presigned PUT)를 흉내 낸다. createUpload로 pending 키를 받아 그 자리에 바로 올린다.
export async function uploadAsBrowser(kind: UploadKind, bytes: Uint8Array, mimeType: string): Promise<string> {
  const { uploadId, key } = await createUpload({ kind, mimeType, sizeBytes: bytes.length });
  await putObject(logicalBucket(kind), key, bytes, mimeType);
  return uploadId;
}

export async function cardId(setCode = "sv2a", number = "201/165"): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    select id from cards where set_code = ${setCode} and collector_number = ${number}`;
  return row.id;
}

export async function resetArtworks(): Promise<void> {
  await sql`truncate artworks, artwork_files, consent_events, reports, report_throttle, requests, card_demand, events cascade`;
  for (const bucket of ["artworks", "consent-evidence"] as const) {
    const keys = await list(bucket, "");
    if (keys.length) await remove(bucket, keys);
  }
}

export async function storedPaths(): Promise<string[]> {
  // 버킷 전체(pending/ 포함)를 사전순으로 — 기존 `order by name`과 동일(S3 list도 사전순).
  return list("artworks", "");
}

export async function evidencePaths(): Promise<string[]> {
  return list("consent-evidence", "");
}
