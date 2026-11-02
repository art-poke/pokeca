import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

// blocked until sub D (storage): 이 스위트 전체가 Supabase 스토리지(업로드·다운로드·미리보기 생성)에
// 의존한다. 비스토리지 로직(목록/상태/엔게이지먼트)은 *-drizzle.test.ts가 커버한다.

// @/auth는 node 전용 next-auth를 끌어와 테스트 환경에서 import가 깨진다(artists-auth.test.ts와 동일).
// 이 스위트는 세션을 쓰지 않으므로 전체를 모킹만 해 둔다.
vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
import {
  addEvidence,
  ArtworkError,
  attachFile,
  createArtwork,
  getArtworkDetail,
  listPublicArtworks,
  resolveDownload,
  resolveThumbnail,
  setStatus,
  type NewArtwork,
} from "@/lib/artworks";
import { createUpload } from "@/lib/storage";
import { getObject } from "@/lib/storage-client";
import {
  ART_PNG,
  cardId,
  FAKE_PNG,
  PDF,
  PNG,
  resetArtworks,
  sql,
  storedPaths,
  uploadAsBrowser,
} from "../helpers/fixtures";

afterAll(() => sql.end());
beforeEach(resetArtworks);

async function base(overrides: Partial<NewArtwork> = {}): Promise<NewArtwork> {
  return {
    id: crypto.randomUUID(),
    cardId: await cardId(),
    artistName: "도안작가",
    format: "9pocket",
    sourceUrl: "https://cafe.naver.com/example/123",
    sourceVisibility: "public",
    printSizeVerified: false,
    ...overrides,
  };
}

// PDF 원본 + 직접 올린 미리보기.
async function stored(overrides: Partial<NewArtwork> = {}) {
  const input = await base(overrides);
  const original = await uploadAsBrowser("original", PDF, "application/pdf");
  const thumbnail = await uploadAsBrowser("thumbnail", PNG, "image/png");
  await createArtwork(input, { original, thumbnail }, "test");
  return input.id;
}

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e) => e instanceof ArtworkError && e.code === code);
}

async function files(id: string) {
  return sql<{ kind: string; mime_type: string; path: string }[]>`
    select kind, mime_type, path from artwork_files where artwork_id = ${id} order by kind`;
}

describe("upload and create", () => {
  it("moves uploads out of pending and serves the original as a download", async () => {
    const id = await stored();
    const paths = await storedPaths();
    expect(paths.every((p) => p.startsWith(`artworks/${id}/`))).toBe(true);
    expect(paths).toHaveLength(2);

    const [item] = await listPublicArtworks(await cardId());
    expect(item).toEqual({
      id,
      title: "도안작가님의 도안",
      artistName: "도안작가",
      format: "9pocket",
      sourceUrl: "https://cafe.naver.com/example/123",
      sourceDomain: "cafe.naver.com",
      membersOnly: false,
      printSizeVerified: false,
      artistHandle: null,
    });

    const download = await resolveDownload(id);
    expect(download.kind).toBe("ok");
    const res = await fetch((download as { url: string }).url);
    expect(res.headers.get("content-disposition")).toContain("sv2a_201-165");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF);
    expect(await resolveThumbnail(id)).toMatch(/^http/);
  });

  it("makes a webp preview from an image original when no preview is uploaded", async () => {
    const input = await base({ sourceUrl: null, sourceVisibility: null });
    const original = await uploadAsBrowser("original", ART_PNG, "image/png");
    await createArtwork(input, { original }, "test");

    const rows = await files(input.id);
    expect(rows.map((r) => [r.kind, r.mime_type])).toEqual([
      ["original", "image/png"],
      ["thumbnail", "image/webp"],
    ]);
    const data = await getObject("artworks", rows[1].path);
    const meta = await sharp(data).metadata();
    expect(meta).toMatchObject({ format: "webp", hasAlpha: true, height: 1600 });
    expect(meta.width).toBeLessThan(1600);
  });

  it("requires an original, and a preview upload for PDF originals", async () => {
    await expectCode(createArtwork(await base(), {}, "test"), "original_required");
    const original = await uploadAsBrowser("original", PDF, "application/pdf");
    await expectCode(createArtwork(await base(), { original }, "test"), "pdf_needs_thumbnail");
  });

  it("reports an unreadable image original instead of storing it without a preview", async () => {
    const original = await uploadAsBrowser("original", PNG, "image/png");
    await expectCode(createArtwork(await base(), { original }, "test"), "preview_failed");
    const [{ count }] = await sql<{ count: number }[]>`select count(*)::int from artworks`;
    expect(count).toBe(0);
  });

  it("is idempotent when the same artwork is submitted twice", async () => {
    const input = await base();
    const original = await uploadAsBrowser("original", PDF, "application/pdf");
    const thumbnail = await uploadAsBrowser("thumbnail", PNG, "image/png");
    await createArtwork(input, { original, thumbnail }, "test");
    await createArtwork(input, { original, thumbnail }, "test");
    const [{ count }] = await sql<{ count: number }[]>`select count(*)::int from artworks`;
    expect(count).toBe(1);
  });

  it("rejects a file whose bytes do not match its type and deletes it", async () => {
    const original = await uploadAsBrowser("original", FAKE_PNG, "image/png");
    await expectCode(createArtwork(await base(), { original }, "test"), "bad_file_type");
    expect(await storedPaths()).toEqual([]);
    const [{ count }] = await sql<{ count: number }[]>`select count(*)::int from artworks`;
    expect(count).toBe(0);
  });

  it("refuses types and sizes the bucket would not accept", async () => {
    await expect(createUpload({ kind: "original", mimeType: "image/gif", sizeBytes: 10 })).rejects.toThrow("bad_file_type");
    await expect(createUpload({ kind: "thumbnail", mimeType: "application/pdf", sizeBytes: 10 })).rejects.toThrow("bad_file_type");
    await expect(
      createUpload({ kind: "original", mimeType: "application/pdf", sizeBytes: 100 * 1024 * 1024 + 1 }),
    ).rejects.toThrow("file_too_large");
  });

  it("hides the source link when the post is gone, and marks members-only posts", async () => {
    const gone = await stored();
    const members = await stored({ sourceVisibility: "members_only" });
    await sql`update artworks set link_status = 'deleted' where id = ${gone}`;
    const items = await listPublicArtworks(await cardId());
    expect(items.find((i) => i.id === gone)).toMatchObject({ sourceUrl: null, sourceDomain: null, membersOnly: false });
    expect(items.find((i) => i.id === members)).toMatchObject({ membersOnly: true });
    // 최신 등록 순
    expect(items.map((i) => i.id)).toEqual([members, gone]);
  });
});

describe("replacing files", () => {
  it("regenerates the preview when an image original replaces the old one", async () => {
    const id = await stored();
    const [, oldThumb] = await files(id);
    await attachFile(id, "original", await uploadAsBrowser("original", ART_PNG, "image/png"));

    const rows = await files(id);
    expect(rows.map((r) => [r.kind, r.mime_type])).toEqual([
      ["original", "image/png"],
      ["thumbnail", "image/webp"],
    ]);
    expect(rows[1].path).not.toBe(oldThumb.path);
    expect(await storedPaths()).toEqual(rows.map((r) => r.path).sort());
  });
});

describe("status", () => {
  it("hides, restores, then withdraws and deletes files", async () => {
    const id = await stored();

    await setStatus(id, "hidden", { actor: "test" });
    expect(await resolveDownload(id)).toEqual({ kind: "unavailable" });
    expect(await resolveThumbnail(id)).toBeNull();
    expect(await listPublicArtworks(await cardId())).toEqual([]);

    await setStatus(id, "active", { actor: "test" });
    expect((await resolveDownload(id)).kind).toBe("ok");

    const result = await setStatus(id, "withdrawn", { reason: "artist request", actor: "test" });
    expect(result).toEqual({ changed: true, purged: true });
    expect(await storedPaths()).toEqual([]);
    expect(await resolveDownload(id)).toEqual({ kind: "unavailable" });
    const [row] = await sql`select status, files_purged from artworks where id = ${id}`;
    expect(row).toEqual({ status: "withdrawn", files_purged: true });

    await expectCode(setStatus(id, "active", { actor: "test" }), "withdrawn_is_final");
    await expectCode(
      addEvidence(id, await uploadAsBrowser("evidence", PNG, "image/png"), { actor: "test" }),
      "withdrawn_is_final",
    );

    const events = await sql`select kind, after from consent_events where artwork_id = ${id} order by id`;
    expect(events.map((e) => [e.kind, e.after.status])).toEqual([
      ["created", "active"],
      ["status", "hidden"],
      ["status", "active"],
      ["status", "withdrawn"],
    ]);
  });

  it("returns 404 for unknown artworks and 410 for unavailable ones (eng E2)", async () => {
    expect(await resolveDownload(crypto.randomUUID())).toEqual({ kind: "not_found" });
    expect(await resolveDownload("not-a-uuid")).toEqual({ kind: "not_found" });
  });
});

// 여러 조각(9포켓 등): 조각마다 원본+미리보기를 position으로 저장하고, 다운로드는 ZIP으로 묶는다.
describe("multiple pieces (9pocket)", () => {
  async function storedMulti(count: number, overrides: Partial<NewArtwork> = {}) {
    const input = await base(overrides);
    const originals = await Promise.all(
      Array.from({ length: count }, () => uploadAsBrowser("original", ART_PNG, "image/png")),
    );
    await createArtwork(input, { originals }, "test");
    return input.id;
  }

  it("stores one original + one auto-preview per piece with sequential positions", async () => {
    const id = await storedMulti(3);
    const rows = await sql<{ kind: string; position: number }[]>`
      select kind, position from artwork_files where artwork_id = ${id} order by kind, position`;
    expect(rows).toEqual([
      { kind: "original", position: 0 },
      { kind: "original", position: 1 },
      { kind: "original", position: 2 },
      { kind: "thumbnail", position: 0 },
      { kind: "thumbnail", position: 1 },
      { kind: "thumbnail", position: 2 },
    ]);
    // 조각마다 경로가 달라야 한다(uploadId가 다르므로).
    expect(new Set(await storedPaths()).size).toBe(6);

    const detail = await getArtworkDetail(id);
    expect(detail?.pieceCount).toBe(3);
  });

  it("serves a per-position thumbnail", async () => {
    const id = await storedMulti(2);
    expect(await resolveThumbnail(id, 0)).toMatch(/^https?:\/\//);
    expect(await resolveThumbnail(id, 1)).toMatch(/^https?:\/\//);
    // 범위를 벗어난 position은 첫 조각으로 대체한다(404가 아니라).
    expect(await resolveThumbnail(id, 9)).toMatch(/^https?:\/\//);
  });

  it("downloads multiple pieces as a ZIP, single piece as a signed URL", async () => {
    const multiId = await storedMulti(2);
    const result = await resolveDownload(multiId);
    expect(result.kind).toBe("zip");
    if (result.kind === "zip") {
      // ZIP local file header 매직넘버 "PK\x03\x04".
      expect(Array.from(result.bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
      expect(result.filename).toMatch(/\.zip$/);
    }

    const singleId = await storedMulti(1);
    expect((await resolveDownload(singleId)).kind).toBe("ok");
  });

  it("keeps the chosen slots when pieces are placed out of order (not 0,1,2…)", async () => {
    const input = await base();
    // 1번·8번 칸만 채운 9포켓(자리 0과 7).
    const originals = [
      { uploadId: await uploadAsBrowser("original", ART_PNG, "image/png"), position: 7 },
      { uploadId: await uploadAsBrowser("original", ART_PNG, "image/png"), position: 0 },
    ];
    await createArtwork(input, { originals }, "test");

    const detail = await getArtworkDetail(input.id);
    expect(detail?.pieceCount).toBe(2);
    expect(detail?.positions).toEqual([0, 7]); // 정렬된 실제 자리
    // 빈 자리는 미리보기가 없다.
    expect(await resolveThumbnail(input.id, 0)).toMatch(/^https?:\/\//);
    expect(await resolveThumbnail(input.id, 7)).toMatch(/^https?:\/\//);
  });

  it("rejects two pieces on the same slot", async () => {
    const input = await base();
    const originals = [
      { uploadId: await uploadAsBrowser("original", ART_PNG, "image/png"), position: 2 },
      { uploadId: await uploadAsBrowser("original", ART_PNG, "image/png"), position: 2 },
    ];
    await expectCode(createArtwork(input, { originals }, "test"), "duplicate_position");
  });
});
