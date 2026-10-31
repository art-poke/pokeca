import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  listOpenRequests,
  requestArt,
  requestedFormats,
  resolveRequests,
  resolvedCountByArtist,
} from "@/lib/art-requests";
import { db } from "@/lib/supabase/server";
import { cardId, sql } from "../helpers/fixtures";

// 규격별 도안 요청 → 요청방 집계 → 작가 업로드 시 해결 처리 → 작가 해결수.
const sb = db();
let artistId: string;
let m1: string;
let m2: string;
let card: string;
let label: string;

async function makeUser(email: string): Promise<string> {
  const { data, error } = await sb.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("no user");
  return data.user.id;
}

beforeAll(async () => {
  card = await cardId(); // sv2a 201/165
  label = "sv2a 201/165";
  const tag = Date.now();
  artistId = await makeUser(`req-artist-${tag}@example.com`);
  m1 = await makeUser(`req-m1-${tag}@example.com`);
  m2 = await makeUser(`req-m2-${tag}@example.com`);
  await sql`delete from requests where card_id = ${card}`;
});

afterAll(async () => {
  await sql`delete from requests where card_id = ${card}`;
  await sql`delete from auth.users where id in (${artistId}, ${m1}, ${m2})`;
  await sql.end();
});

describe("도안 요청 → 해결", () => {
  it("규격별로 요청하고 요청방에 모은다", async () => {
    await requestArt(m1, card, "9pocket");
    await requestArt(m2, card, "9pocket");
    await requestArt(m1, card, "psa");
    await requestArt(m1, card, "9pocket"); // 중복 무시

    const open = (await listOpenRequests()).filter((r) => r.cardLabel === label);
    const ninePocket = open.find((r) => r.format === "9pocket");
    const psa = open.find((r) => r.format === "psa");
    expect(ninePocket?.count).toBe(2);
    expect(psa?.count).toBe(1);
    expect((await requestedFormats(m1, card)).sort()).toEqual(["9pocket", "psa"]);
  });

  it("작가가 그 규격을 올리면 해결 처리되어 요청방에서 내려간다", async () => {
    await resolveRequests(card, "9pocket", artistId);

    const open = (await listOpenRequests()).filter((r) => r.cardLabel === label);
    expect(open.find((r) => r.format === "9pocket")).toBeUndefined();
    expect(open.find((r) => r.format === "psa")?.count).toBe(1); // psa는 남음
    expect(await requestedFormats(m1, card)).toEqual(["psa"]);
    expect(await resolvedCountByArtist(artistId)).toBe(2); // m1·m2의 9pocket 요청 2건
  });
});
