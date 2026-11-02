import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import sharp from "sharp";
import { createUpload, type UploadKind } from "@/lib/storage";

export const sql = postgres(process.env.SUPABASE_DB_URL!, { onnotice: () => {} });

export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3, 4]);
export const PDF = new TextEncoder().encode("%PDF-1.7\n%test\n");
export const FAKE_PNG = new TextEncoder().encode("this is not a png at all");
// 미리보기를 만들 수 있는 진짜 이미지(반투명 PNG, 2000×2800 → 미리보기 최대 1600px로 줄어든다).
export const ART_PNG = new Uint8Array(
  await sharp({ create: { width: 2000, height: 2800, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 0.5 } } })
    .png()
    .toBuffer(),
);

// 브라우저처럼 공개 키 클라이언트로 서명 업로드 URL에 올린다.
// 지연 생성: supabase-js는 import 시 realtime(WebSocket)을 건드려 node 20에서 모듈 로드가 깨진다.
// 이 헬퍼를 실제로 쓰는 스위트는 전부 서브 D까지 skip이라, 호출될 때만 클라이언트를 만든다.
let browserClient: ReturnType<typeof createClient> | undefined;
const browser = () =>
  (browserClient ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  ));

export async function uploadAsBrowser(kind: UploadKind, bytes: Uint8Array, mimeType: string): Promise<string> {
  const { uploadId, path, token } = await createUpload({ kind, mimeType, sizeBytes: bytes.length });
  const { error } = await browser()
    .storage.from(kind === "evidence" ? "consent-evidence" : "artworks")
    .uploadToSignedUrl(path, token, new Blob([new Uint8Array(bytes)], { type: mimeType }), { contentType: mimeType });
  if (error) throw error;
  return uploadId;
}

export async function cardId(setCode = "sv2a", number = "201/165"): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    select id from cards where set_code = ${setCode} and collector_number = ${number}`;
  return row.id;
}

export async function resetArtworks(): Promise<void> {
  await sql`truncate artworks, artwork_files, consent_events, reports, report_throttle, requests, card_demand, events cascade`;
  for (const bucket of ["artworks", "consent-evidence"]) {
    const objects = await sql<{ name: string }[]>`select name from storage.objects where bucket_id = ${bucket}`;
    if (objects.length) {
      const { storageClient } = await import("@/lib/storage-client");
      await storageClient().from(bucket).remove(objects.map((o) => o.name));
    }
  }
}

export async function storedPaths(): Promise<string[]> {
  const rows = await sql<{ name: string }[]>`
    select name from storage.objects where bucket_id = 'artworks' order by name`;
  return rows.map((r) => r.name);
}

export async function evidencePaths(): Promise<string[]> {
  const rows = await sql<{ name: string }[]>`
    select name from storage.objects where bucket_id = 'consent-evidence' order by name`;
  return rows.map((r) => r.name);
}
