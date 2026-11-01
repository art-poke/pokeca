import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { artistReviews, artists } from "@/lib/db/schema";
import { REVIEW_MAX } from "@/lib/profile";
import { promoteReviewImage, StorageInputError } from "@/lib/storage";
import { UUID } from "@/lib/uuid";

// 작가 후기 (20261031000007). 회원이 작가에게 남기는 이미지+텍스트 후기.
// 작가 공개페이지·스튜디오·커뮤니티에서 함께 보인다.

export class ReviewError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export type Review = {
  id: string;
  authorName: string;
  body: string;
  hasImage: boolean;
  createdAt: string;
  mine: boolean; // 보는 사람이 작성자인가(삭제 버튼 노출)
};

export async function listArtistReviews(artistId: string, viewerUserId: string | null): Promise<Review[]> {
  if (!UUID.test(artistId)) return [];
  const data = await db
    .select({
      id: artistReviews.id,
      userId: artistReviews.userId,
      authorName: artistReviews.authorName,
      body: artistReviews.body,
      imagePath: artistReviews.imagePath,
      createdAt: artistReviews.createdAt,
    })
    .from(artistReviews)
    .where(and(eq(artistReviews.artistId, artistId), isNull(artistReviews.deletedAt)))
    .orderBy(desc(artistReviews.createdAt));
  return data.map((r) => ({
    id: r.id,
    authorName: r.authorName,
    body: r.body,
    hasImage: !!r.imagePath,
    createdAt: r.createdAt.toISOString(),
    mine: !!viewerUserId && r.userId === viewerUserId,
  }));
}

export async function reviewCount(artistId: string): Promise<number> {
  if (!UUID.test(artistId)) return 0;
  const rows = await db
    .select({ n: count() })
    .from(artistReviews)
    .where(and(eq(artistReviews.artistId, artistId), isNull(artistReviews.deletedAt)));
  return rows[0]?.n ?? 0;
}

export async function createReview(input: {
  artistId: string;
  userId: string;
  authorName: string;
  body: string;
  imageUploadId?: string | null;
}): Promise<string> {
  if (!UUID.test(input.artistId)) throw new ReviewError("not_found");
  // 작가가 있고 승인 상태인지 확인(후기는 공개 작가에게만).
  const artistRows = await db
    .select({ userId: artists.userId, status: artists.status })
    .from(artists)
    .where(eq(artists.userId, input.artistId))
    .limit(1);
  const artist = artistRows[0] ?? null;
  if (!artist || artist.status !== "approved") throw new ReviewError("not_found");
  if (input.userId === input.artistId) throw new ReviewError("self_review");

  const body = input.body.trim();
  if (!body) throw new ReviewError("body_required");
  if (body.length > REVIEW_MAX) throw new ReviewError("body_too_long");

  let imagePath: string | null = null;
  if (input.imageUploadId) {
    try {
      imagePath = await promoteReviewImage(input.imageUploadId);
    } catch (e) {
      if (e instanceof StorageInputError) throw new ReviewError(e.message);
      throw e;
    }
  }

  const inserted = await db
    .insert(artistReviews)
    .values({
      artistId: input.artistId,
      userId: input.userId,
      authorName: input.authorName,
      body,
      imagePath,
    })
    .returning({ id: artistReviews.id });
  return inserted[0].id;
}

// 작성자 본인 또는 어드민만. soft delete.
export async function deleteReview(id: string, userId: string, isAdmin: boolean): Promise<void> {
  if (!UUID.test(id)) throw new ReviewError("not_found");
  const rows = await db
    .select({ userId: artistReviews.userId, deletedAt: artistReviews.deletedAt })
    .from(artistReviews)
    .where(eq(artistReviews.id, id))
    .limit(1);
  const data = rows[0] ?? null;
  if (!data || data.deletedAt) throw new ReviewError("not_found");
  if (!isAdmin && data.userId !== userId) throw new ReviewError("forbidden");
  await db.update(artistReviews).set({ deletedAt: new Date() }).where(eq(artistReviews.id, id));
}

// 이미지 서빙용: 후기의 image_path(없으면 null).
export async function reviewImageOf(id: string): Promise<string | null> {
  if (!UUID.test(id)) return null;
  const rows = await db
    .select({ imagePath: artistReviews.imagePath })
    .from(artistReviews)
    .where(and(eq(artistReviews.id, id), isNull(artistReviews.deletedAt)))
    .limit(1);
  return rows[0]?.imagePath ?? null;
}

export type RecentReview = {
  id: string;
  authorName: string;
  body: string;
  hasImage: boolean;
  createdAt: string;
  artistHandle: string;
  artistName: string;
};

// 커뮤니티 "작가 후기" 피드: 최근 후기(작가 정보 포함).
export async function recentReviews(limit = 12): Promise<RecentReview[]> {
  const rows = await db
    .select({
      id: artistReviews.id,
      authorName: artistReviews.authorName,
      body: artistReviews.body,
      imagePath: artistReviews.imagePath,
      createdAt: artistReviews.createdAt,
      artistHandle: artists.handle,
      artistName: artists.displayName,
    })
    .from(artistReviews)
    .leftJoin(artists, eq(artistReviews.artistId, artists.userId))
    .where(isNull(artistReviews.deletedAt))
    .orderBy(desc(artistReviews.createdAt))
    .limit(limit);
  return rows
    .filter((r) => r.artistHandle !== null && r.artistName !== null)
    .map((r) => ({
      id: r.id,
      authorName: r.authorName,
      body: r.body,
      hasImage: !!r.imagePath,
      createdAt: r.createdAt.toISOString(),
      artistHandle: r.artistHandle!,
      artistName: r.artistName!,
    }));
}
