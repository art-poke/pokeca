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

// 비ASCII 파일명(한글 등)은 RFC 5987로 인코딩한다. S3는 response-content-disposition에 날 비ASCII가
// 들어오면 400을 돌려주므로(Supabase 클라이언트와 달리) filename*=UTF-8'' 형태가 필수다.
const contentDisposition = (name: string): string => {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
};

export const viewUrl = (logical: string, key: string, opts: { download?: string; ttl?: number } = {}) =>
  getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket(logical), Key: key,
      ...(opts.download ? { ResponseContentDisposition: contentDisposition(opts.download) } : {}),
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

// 정리 작업(lib/cleanup.ts)용 — prefix 아래 모든 key를 LastModified와 함께 재귀 나열(페이지네이션).
// Supabase `.list()`가 주던 created_at(24시간 cutoff 판정)을 S3 LastModified로 대체한다.
export const listWithMeta = async (
  logical: string,
  prefix: string,
): Promise<{ key: string; lastModified: Date | null }[]> => {
  const out: { key: string; lastModified: Date | null }[] = [];
  let token: string | undefined;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: bucket(logical), Prefix: prefix, ContinuationToken: token }));
    for (const o of r.Contents ?? []) if (o.Key) out.push({ key: o.Key, lastModified: o.LastModified ?? null });
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return out;
};
