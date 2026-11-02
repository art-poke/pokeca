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
