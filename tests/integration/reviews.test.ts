import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createReview,
  deleteReview,
  listArtistReviews,
  recentReviews,
  ReviewError,
  reviewCount,
} from "@/lib/reviews";
import { db } from "@/lib/supabase/server";
import { sql } from "../helpers/fixtures";

afterAll(() => sql.end());

let n = 0;
async function user(): Promise<string> {
  n += 1;
  const { data, error } = await db().auth.admin.createUser({
    email: `rev${n}-${Date.now()}@example.com`,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

async function artist(): Promise<string> {
  const uid = await user();
  const ins = await db()
    .from("artists")
    .insert({ user_id: uid, handle: `rv${n}x${Date.now() % 100000}`, display_name: "후기작가", provider: "google", status: "approved" });
  if (ins.error) throw ins.error;
  return uid;
}

async function member(nickname = "수집가"): Promise<string> {
  const uid = await user();
  const ins = await db().from("members").insert({ user_id: uid, nickname });
  if (ins.error) throw ins.error;
  return uid;
}

async function cleanup() {
  await sql`truncate artist_reviews cascade`;
  const users = await sql<{ user_id: string }[]>`
    select user_id from members union select user_id from artists`;
  for (const u of users) await db().auth.admin.deleteUser(u.user_id);
}
beforeEach(cleanup);

describe("artist reviews", () => {
  it("creates and lists a review with the mine flag per viewer", async () => {
    const a = await artist();
    const m = await member("별빛");
    await createReview({ artistId: a, userId: m, authorName: "별빛", body: "  도안 최고예요  " });

    const asAuthor = await listArtistReviews(a, m);
    expect(asAuthor).toHaveLength(1);
    expect(asAuthor[0]).toMatchObject({ authorName: "별빛", body: "도안 최고예요", hasImage: false, mine: true });

    const other = await member("다른회원");
    expect((await listArtistReviews(a, other))[0].mine).toBe(false);
    expect(await reviewCount(a)).toBe(1);
  });

  it("rejects self-review and empty body", async () => {
    const a = await artist();
    const m = await member();
    await expect(createReview({ artistId: a, userId: a, authorName: "x", body: "hi" })).rejects.toSatisfy(
      (e) => e instanceof ReviewError && e.code === "self_review",
    );
    await expect(createReview({ artistId: a, userId: m, authorName: "x", body: "   " })).rejects.toSatisfy(
      (e) => e instanceof ReviewError && e.code === "body_required",
    );
  });

  it("only the author or an admin can delete", async () => {
    const a = await artist();
    const m = await member();
    const other = await member();
    await createReview({ artistId: a, userId: m, authorName: "m", body: "굿" });
    const [rev] = await listArtistReviews(a, m);

    await expect(deleteReview(rev.id, other, false)).rejects.toSatisfy(
      (e) => e instanceof ReviewError && e.code === "forbidden",
    );
    await deleteReview(rev.id, m, false); // 작성자 OK
    expect(await reviewCount(a)).toBe(0);
    // 다시 지우면 not_found(soft delete됨)
    await expect(deleteReview(rev.id, m, false)).rejects.toSatisfy(
      (e) => e instanceof ReviewError && e.code === "not_found",
    );
  });

  it("surfaces in the recent feed with artist handle", async () => {
    const a = await artist();
    const m = await member("피드회원");
    await createReview({ artistId: a, userId: m, authorName: "피드회원", body: "피드 테스트" });
    const feed = await recentReviews(10);
    const mine = feed.find((r) => r.authorName === "피드회원");
    expect(mine).toBeTruthy();
    expect(mine!.artistName).toBe("후기작가");
    expect(mine!.artistHandle).toMatch(/^rv/);
  });
});
