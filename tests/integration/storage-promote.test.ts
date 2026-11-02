import { afterAll, describe, expect, it } from "vitest";
import {
  BUCKET,
  EVIDENCE_BUCKET,
  pendingPath,
  promoteAvatar,
  promoteUpload,
  StorageInputError,
} from "@/lib/storage";
import { head, putObject, remove } from "@/lib/storage-client";

// lib/storage.ts의 promote(크기 강제 + 매직바이트 검증 + copy→delete)를 실 S3로 검증한다.
// 자격 없으면 전체 skip(서브 D: AWS_PROFILE=artpoke 필요).
const run = process.env.S3_BUCKET_UPLOADS && (process.env.AWS_PROFILE || process.env.AWS_ACCESS_KEY_ID);
const d = run ? describe : describe.skip;

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3, 4]);
const NOT_AN_IMAGE = new TextEncoder().encode("this is plainly not a png or anything allowed");
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

d("storage promote (S3)", () => {
  // 테스트가 못 지우고 끝난 잔여물(모든 경로)을 안전하게 청소한다.
  const cleanup: { bucket: string; key: string }[] = [];
  afterAll(async () => {
    for (const bucket of [BUCKET, EVIDENCE_BUCKET]) {
      const keys = cleanup.filter((c) => c.bucket === bucket).map((c) => c.key);
      if (keys.length) await remove(bucket, keys);
    }
  });

  it("아바타가 용량 한도를 넘으면 file_too_large + pending 삭제", async () => {
    const uploadId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const from = pendingPath(uploadId);
    cleanup.push({ bucket: BUCKET, key: from });
    // PNG 매직으로 시작하되 아바타 한도(5MB)를 1바이트 초과하는 몸체.
    const big = new Uint8Array(AVATAR_MAX_BYTES + 1);
    big.set(PNG_MAGIC.slice(0, 8), 0);
    await putObject(BUCKET, from, big, "image/png");

    await expect(promoteAvatar(uploadId, userId)).rejects.toSatisfy(
      (e) => e instanceof StorageInputError && e.message === "file_too_large",
    );
    expect(await head(BUCKET, from)).toBeNull();
  });

  it("매직바이트가 허용 형식이 아니면 bad_file_type + pending 삭제", async () => {
    const uploadId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const from = pendingPath(uploadId);
    cleanup.push({ bucket: BUCKET, key: from });
    await putObject(BUCKET, from, NOT_AN_IMAGE, "image/png");

    await expect(promoteAvatar(uploadId, userId)).rejects.toSatisfy(
      (e) => e instanceof StorageInputError && e.message === "bad_file_type",
    );
    expect(await head(BUCKET, from)).toBeNull();
  });

  it("정상 파일은 copy+delete 후 최종 경로에 존재하고 pending은 사라진다", async () => {
    const uploadId = crypto.randomUUID();
    const artworkId = crypto.randomUUID();
    const from = pendingPath(uploadId);
    cleanup.push({ bucket: BUCKET, key: from });
    await putObject(BUCKET, from, PNG_MAGIC, "image/png");

    const stored = await promoteUpload(uploadId, artworkId, "original");
    cleanup.push({ bucket: BUCKET, key: stored.path });

    expect(stored).toMatchObject({ kind: "original", mimeType: "image/png", sizeBytes: PNG_MAGIC.length });
    expect(stored.path).toBe(`artworks/${artworkId}/original-${uploadId}`);
    expect(await head(BUCKET, stored.path)).not.toBeNull();
    expect(await head(BUCKET, from)).toBeNull();
  });
});
