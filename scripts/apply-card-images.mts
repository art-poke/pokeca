// 받아 둔 공식 카드 이미지를 S3(uploads 버킷 cards/…)에 올리고 cards.image_path를 채운다.
//
//   AWS_PROFILE=artpoke npm run cards:images:apply -- --manifest data/card-images.csv            # S3 업로드 + DB 갱신
//   npm run cards:images:apply -- --manifest data/card-images.csv --no-upload                    # DB만(이미 올려둔 경우)
//
// 대상 DB는 DATABASE_URL, 버킷은 S3_BUCKET_UPLOADS. 둘 다 .env.local 또는 환경 변수.
// 여러 번 돌려도 같다: 같은 크기의 객체가 이미 있으면 업로드를 건너뛴다.
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

// lib/storage-client는 server-only라 스크립트에서 못 쓴다. 같은 버킷·리전 규칙으로 S3를 직접 부른다.
const s3 = new S3Client({ region: process.env.AWS_REGION ?? "ap-northeast-1" });
const Bucket = process.env.S3_BUCKET_UPLOADS;
const head = async (key: string) => {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket, Key: key }));
    return { size: r.ContentLength ?? 0 };
  } catch {
    return null;
  }
};
const putObject = (key: string, body: Buffer) =>
  s3.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable" }));

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const manifestPath = opt("manifest") ?? "data/card-images.csv";
const noUpload = args.includes("--no-upload");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL이 필요해요.");
  process.exit(2);
}
if (!noUpload && !process.env.S3_BUCKET_UPLOADS) {
  console.error("S3_BUCKET_UPLOADS가 필요해요(또는 --no-upload).");
  process.exit(2);
}

// manifest: set_code,collector_number,file,bytes,status,source_url (file/url에 쉼표 없음)
const lines = (await readFile(manifestPath, "utf8")).trim().split(/\r?\n/).slice(1);
const rows = lines
  .map((l) => l.split(","))
  .filter((c) => c[4] === "ok" && c[2])
  .map(([set, number, file, bytes]) => ({ set, number, file, bytes: Number(bytes) }));

const keyOf = (r: { set: string; file: string }) => `cards/${r.set}/${r.file.split("/").pop()}`;

let uploaded = 0, kept = 0;
if (!noUpload) {
  for (const [i, r] of rows.entries()) {
    const key = keyOf(r);
    const existing = await head(key);
    if (existing && existing.size === r.bytes) {
      kept++;
    } else {
      await putObject(key, await readFile(r.file));
      uploaded++;
    }
    if ((i + 1) % 100 === 0) console.log(`S3 ${i + 1}/${rows.length} · 올림 ${uploaded} · 이미 있음 ${kept}`);
  }
  console.log(`S3 완료: 올림 ${uploaded} · 이미 있음 ${kept}`);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const u = new URL(process.env.DATABASE_URL);
  console.log(`DB 대상: ${u.hostname}:${u.port || 5432}${u.pathname}`);
  const { rows: res } = await pool.query<{ n: number }>(
    `with m as (
       select lower(x.set_code) as set_code, x.collector_number, x.image_path
       from jsonb_to_recordset($1::jsonb) as x(set_code text, collector_number text, image_path text)
     )
     update public.cards c set image_path = m.image_path
     from m where c.set_code = m.set_code and c.collector_number = m.collector_number
       and c.image_path is distinct from m.image_path
     returning 1 as n`,
    [JSON.stringify(rows.map((r) => ({ set_code: r.set, collector_number: r.number, image_path: keyOf(r) })))],
  );
  const { rows: cnt } = await pool.query<{ total: string; with_image: string }>(
    "select count(*)::text as total, count(image_path)::text as with_image from public.cards",
  );
  console.log(`DB 갱신 ${res.length}건 · 이미지 있는 카드 ${cnt[0].with_image}/${cnt[0].total}`);
} finally {
  await pool.end();
}
