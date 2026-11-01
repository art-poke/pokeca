import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { attachFile, createArtwork, setStatus } from "@/lib/artworks";
import { cleanup } from "@/lib/cleanup";
import { db } from "@/lib/supabase/server";
import { cardId, PDF, PNG, resetArtworks, sql, storedPaths, uploadAsBrowser } from "../helpers/fixtures";

// @/lib/artworks가 Drizzle(@/lib/db)로 전환됐다. 스토리지·시드 카드는 아직 Supabase(sub D)이므로
// 둘이 같은 Postgres를 보도록, @/lib/db가 Pool을 만들기 전에 DATABASE_URL을 Supabase DB로 맞춘다(hoisted).
vi.hoisted(() => {
  if (process.env.SUPABASE_DB_URL) process.env.DATABASE_URL = process.env.SUPABASE_DB_URL;
});

afterAll(() => sql.end());
beforeEach(resetArtworks);

const DAY = 24 * 60 * 60 * 1000;
const later = () => new Date(Date.now() + DAY + 60_000);

async function hostedArtwork() {
  const id = crypto.randomUUID();
  const original = await uploadAsBrowser("original", PDF, "application/pdf");
  const thumbnail = await uploadAsBrowser("thumbnail", PNG, "image/png");
  await createArtwork(
    {
      id, cardId: await cardId(), artistName: "정리", format: "psa", sourceUrl: null, sourceVisibility: null,
      printSizeVerified: false,
    },
    { original, thumbnail },
    "test",
  );
  return id;
}

describe("cleanup", () => {
  it("keeps fresh pending uploads and removes ones older than 24 hours", async () => {
    await uploadAsBrowser("original", PDF, "application/pdf");
    expect(await cleanup()).toMatchObject({ pending: 0 });
    expect(await storedPaths()).toHaveLength(1);

    expect(await cleanup(later())).toMatchObject({ pending: 1 });
    expect(await storedPaths()).toEqual([]);
  });

  it("removes files moved into artworks/ whose row was never created", async () => {
    const orphan = `artworks/${crypto.randomUUID()}/original-x`;
    await db().storage.from("artworks").upload(orphan, PNG, { contentType: "image/png" });
    const id = await hostedArtwork();

    expect(await cleanup()).toMatchObject({ orphaned: 0 });
    expect(await cleanup(later())).toMatchObject({ orphaned: 1 });
    expect((await storedPaths()).every((p) => p.startsWith(`artworks/${id}/`))).toBe(true);
  });

  it("retries deleting files of withdrawn artworks", async () => {
    const id = await hostedArtwork();
    // 커밋 후 삭제가 실패한 상태를 흉내 낸다: 철회됐지만 파일 행이 남아 있음.
    await sql`update artworks set status = 'withdrawn', files_purged = false where id = ${id}`;

    expect(await cleanup()).toMatchObject({ withdrawn: 2 });
    expect(await storedPaths()).toEqual([]);
    const [row] = await sql`select files_purged from artworks where id = ${id}`;
    expect(row.files_purged).toBe(true);
  });

  it("leaves active artworks alone", async () => {
    const id = await hostedArtwork();
    await setStatus(id, "hidden", { actor: "test" });
    await cleanup(later());
    expect(await storedPaths()).toHaveLength(2);
  });

  it("removes untracked files inside a known artwork folder (replaced file whose purge failed)", async () => {
    const id = await hostedArtwork();
    const stray = `artworks/${id}/original-stale`;
    await db().storage.from("artworks").upload(stray, PDF, { contentType: "application/pdf" });

    expect(await cleanup(later())).toMatchObject({ orphaned: 1 });
    const paths = await storedPaths();
    expect(paths).toHaveLength(2);
    expect(paths).not.toContain(stray);
  });

  it("replacing a file tracks only the new one and deletes the old one", async () => {
    const id = await hostedArtwork();
    const [old] = await sql<{ path: string }[]>`select path from artwork_files where artwork_id = ${id} and kind = 'thumbnail'`;
    const upload = await uploadAsBrowser("thumbnail", PNG, "image/png");
    await attachFile(id, "thumbnail", upload);
    const rows = await sql<{ path: string }[]>`select path from artwork_files where artwork_id = ${id} and kind = 'thumbnail'`;
    expect(rows.map((r) => r.path)).toEqual([`artworks/${id}/thumbnail-${upload}`]);
    expect(await storedPaths()).not.toContain(old.path);
  });

  it("does not move an upload into a withdrawn artwork, and rejects non-UUID ids", async () => {
    const id = await hostedArtwork();
    await setStatus(id, "withdrawn", { actor: "test" });
    const upload = await uploadAsBrowser("thumbnail", PNG, "image/png");
    await expect(attachFile(id, "thumbnail", upload)).rejects.toMatchObject({ code: "withdrawn_is_final" });
    await expect(attachFile("../pending", "thumbnail", upload)).rejects.toMatchObject({ code: "not_found" });
    expect(await storedPaths()).toEqual([`pending/${upload}`]);
  });

  it("drops report abuse counters after 24 hours", async () => {
    await sql`insert into report_throttle (ip_hash) values ('h1')`;
    expect(await cleanup()).toMatchObject({ throttle: 0 });
    expect(await cleanup(later())).toMatchObject({ throttle: 1 });
  });
});
