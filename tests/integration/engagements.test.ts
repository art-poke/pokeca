import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ArtworkError } from "@/lib/artworks";
import {
  getEngagement,
  recommendCount,
  recordDownloadEngagement,
  toggleRecommend,
} from "@/lib/engagements";
import { artistRanking, artworkRanking } from "@/lib/ranking";
import { db } from "@/lib/supabase/server";
import { cardId, sql } from "../helpers/fixtures";

// 추천/다운로드 점수(중복불가 배타) + 랭킹 집계.
const sb = db();

let artistId: string;
let m1: string;
let m2: string;
let card: string;
let art1: string;
let art2: string;

async function makeUser(email: string): Promise<string> {
  const { data, error } = await sb.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("no user");
  return data.user.id;
}

async function insertArtwork(name: string): Promise<string> {
  const id = crypto.randomUUID();
  await sql`
    insert into artworks (id, card_id, artist_name, artist_id, format, status)
    values (${id}, ${card}, ${name}, ${artistId}, '9pocket', 'active')`;
  return id;
}

beforeAll(async () => {
  card = await cardId();
  const tag = Date.now();
  artistId = await makeUser(`eng-artist-${tag}@example.com`);
  m1 = await makeUser(`eng-m1-${tag}@example.com`);
  m2 = await makeUser(`eng-m2-${tag}@example.com`);
  await sql`
    insert into artists (user_id, handle, display_name, provider, status)
    values (${artistId}, ${"engartist" + tag}, '점수작가', 'google', 'approved')`;
  art1 = await insertArtwork("점수작가");
  art2 = await insertArtwork("점수작가");
});

afterAll(async () => {
  await sql`delete from engagements where artwork_id in (${art1}, ${art2})`;
  await sql`delete from artworks where id in (${art1}, ${art2})`;
  await sql`delete from artists where user_id = ${artistId}`;
  await sql`delete from auth.users where id in (${artistId}, ${m1}, ${m2})`;
  await sql.end();
});

describe("engagements (추천/다운로드 점수)", () => {
  it("추천을 토글하고 점수를 중복 없이 센다", async () => {
    expect(await toggleRecommend(m1, art1)).toEqual({ recommended: true });
    expect(await getEngagement(m1, art1)).toBe("recommend");
    expect(await recommendCount(art1)).toBe(1);

    // 같은 유저 재추천 = 취소(토글)
    expect(await toggleRecommend(m1, art1)).toEqual({ recommended: false });
    expect(await getEngagement(m1, art1)).toBeNull();
    expect(await recommendCount(art1)).toBe(0);
  });

  it("다운로드한 도안은 추천이 막힌다(배타)", async () => {
    await recordDownloadEngagement(m1, art1);
    expect(await getEngagement(m1, art1)).toBe("download");
    await expect(toggleRecommend(m1, art1)).rejects.toSatisfy(
      (e) => e instanceof ArtworkError && e.code === "already_downloaded",
    );
    // 다운로드 중복 기록은 1점 유지
    await recordDownloadEngagement(m1, art1);
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int from engagements where user_id = ${m1} and artwork_id = ${art1}`;
    expect(count).toBe(1);
  });
});

describe("ranking", () => {
  it("도안 랭킹은 추천 수, 작가 랭킹은 engagement 수로 매긴다", async () => {
    // art1: m1 download(앞 테스트) + m2 recommend → 추천 1, engagement 2
    // art2: m2 recommend → 추천 1, engagement 1
    await toggleRecommend(m2, art1);
    await toggleRecommend(m2, art2);

    const artworks = await artworkRanking("all");
    const ranked = artworks.filter((a) => a.artworkId === art1 || a.artworkId === art2);
    expect(ranked.find((a) => a.artworkId === art1)?.recommends).toBe(1);
    expect(ranked.find((a) => a.artworkId === art2)?.recommends).toBe(1);

    const artists = await artistRanking("all");
    const me = artists.find((a) => a.userId === artistId);
    expect(me).toBeTruthy();
    // 내 도안들의 engagement: art1(m1 download, m2 recommend)=2, art2(m2 recommend)=1 → 3
    expect(me!.score).toBe(3);
    expect(me!.name).toBe("점수작가");
  });
});
