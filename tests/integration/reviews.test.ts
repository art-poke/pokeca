import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createReview,
  deleteReview,
  listArtistReviews,
  recentReviews,
  ReviewError,
  reviewCount,
} from "@/lib/reviews";
import { db } from "@/lib/db";
import { artistReviews, artists, users } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

// 작가 후기 생성/목록(집계·mine)/소프트삭제/최근 피드를 로컬 Docker Postgres(5432)에 직접 검증한다.
// 이미지 경로는 스토리지 결합을 피하려 쓰지 않는다(imageUploadId 미지정 경로).

const TAG = `rev${Date.now()}`;
const HANDLE = `${TAG}h`;

let artistId: string; // 승인 작가
let pendingArtistId: string; // 미승인 작가
let memberA: string;
let memberB: string;

beforeAll(async () => {
  [{ id: artistId }, { id: pendingArtistId }, { id: memberA }, { id: memberB }] = await db
    .insert(users)
    .values([
      { email: `${TAG}-artist@example.com` },
      { email: `${TAG}-pending@example.com` },
      { email: `${TAG}-m1@example.com` },
      { email: `${TAG}-m2@example.com` },
    ])
    .returning({ id: users.id });

  await db.insert(artists).values([
    { userId: artistId, handle: HANDLE, displayName: "후기작가", provider: "google" },
    // 미발행(handle 없음) 프로필 — 후기 대상이 될 수 없다.
    { userId: pendingArtistId, handle: null, displayName: "대기작가", provider: "google" },
  ]);
});

afterAll(async () => {
  await db.delete(artistReviews).where(inArray(artistReviews.artistId, [artistId, pendingArtistId]));
  await db.delete(artists).where(inArray(artists.userId, [artistId, pendingArtistId]));
  await db.delete(users).where(inArray(users.id, [artistId, pendingArtistId, memberA, memberB]));
});

describe("createReview / listArtistReviews / reviewCount", () => {
  it("후기를 생성하고 목록·카운트·mine 플래그를 반환한다", async () => {
    await createReview({ artistId, userId: memberA, authorName: "별빛", body: "  도안 최고예요  " });

    const asAuthor = await listArtistReviews(artistId, memberA);
    expect(asAuthor).toHaveLength(1);
    expect(asAuthor[0]).toMatchObject({ authorName: "별빛", body: "도안 최고예요", hasImage: false, mine: true });

    const asOther = await listArtistReviews(artistId, memberB);
    expect(asOther[0].mine).toBe(false);
    expect(await reviewCount(artistId)).toBe(1);
  });

  it("자기후기·빈 본문·미승인 작가를 거절한다", async () => {
    await expect(
      createReview({ artistId, userId: artistId, authorName: "x", body: "hi" }),
    ).rejects.toSatisfy((e) => e instanceof ReviewError && e.code === "self_review");
    await expect(
      createReview({ artistId, userId: memberA, authorName: "x", body: "   " }),
    ).rejects.toSatisfy((e) => e instanceof ReviewError && e.code === "body_required");
    await expect(
      createReview({ artistId: pendingArtistId, userId: memberA, authorName: "x", body: "hi" }),
    ).rejects.toSatisfy((e) => e instanceof ReviewError && e.code === "not_found");
  });
});

describe("deleteReview", () => {
  it("작성자/어드민만 소프트삭제하고 재삭제는 not_found", async () => {
    await createReview({ artistId, userId: memberB, authorName: "굿회원", body: "굿" });
    const list = await listArtistReviews(artistId, memberB);
    const rev = list.find((r) => r.authorName === "굿회원")!;

    await expect(deleteReview(rev.id, memberA, false)).rejects.toSatisfy(
      (e) => e instanceof ReviewError && e.code === "forbidden",
    );
    await deleteReview(rev.id, memberB, false); // 작성자 OK
    await expect(deleteReview(rev.id, memberB, false)).rejects.toSatisfy(
      (e) => e instanceof ReviewError && e.code === "not_found",
    );
  });
});

describe("recentReviews", () => {
  it("최근 피드에 작가 핸들·이름과 함께 노출된다", async () => {
    const feed = await recentReviews(50);
    const mine = feed.find((r) => r.authorName === "별빛" && r.artistHandle === HANDLE);
    expect(mine).toBeTruthy();
    expect(mine!.artistName).toBe("후기작가");
  });
});
