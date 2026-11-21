import { expect, test } from "@playwright/test";
import { clearArtworks, memberSessionCookie, seedArtwork, sql } from "./db";

// DB를 공유하므로 이 파일은 한 브라우저 프로젝트에서만, 순서대로 돈다.
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "API test runs once");

test.beforeEach(clearArtworks);

test("hosted artwork returns a short-lived download URL", async ({ context, baseURL }) => {
  const id = await seedArtwork();
  const request = context.request;
  expect((await request.post(`/api/download/${id}`)).status()).toBe(401);
  await context.addCookies([await memberSessionCookie(baseURL!)]);
  const res = await request.post(`/api/download/${id}`);
  expect(res.status()).toBe(200);
  const { url } = await res.json();
  const file = await request.get(url);
  expect(file.status()).toBe(200);
  expect(file.headers()["content-disposition"]).toContain("sv2a_201-165");
});

test("unknown artwork is 404, hidden or withdrawn is 410 without details (eng E2)", async ({ context, baseURL }) => {
  await context.addCookies([await memberSessionCookie(baseURL!)]);
  const request = context.request;
  expect((await request.post(`/api/download/${crypto.randomUUID()}`)).status()).toBe(404);

  const hidden = await seedArtwork({ status: "hidden" });
  const res = await request.post(`/api/download/${hidden}`);
  expect(res.status()).toBe(410);
  expect(await res.json()).toEqual({ code: "unavailable" });

  const withdrawn = await seedArtwork({ status: "withdrawn" });
  expect((await request.post(`/api/download/${withdrawn}`)).status()).toBe(410);
});

test("preview redirects only while active", async ({ request }) => {
  const id = await seedArtwork();
  const ok = await request.get(`/api/thumbnails/${id}`, { maxRedirects: 0 });
  expect(ok.status()).toBe(302);

  await sql`update artworks set status = 'hidden' where id = ${id}`;
  expect((await request.get(`/api/thumbnails/${id}`, { maxRedirects: 0 })).status()).toBe(404);
});
