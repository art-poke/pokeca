import "server-only";
import { REVIEW_MAX } from "@/lib/profile";
import { promoteReviewImage, StorageInputError } from "@/lib/storage";
import { db } from "@/lib/supabase/server";
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

type Row = {
  id: string;
  user_id: string;
  author_name: string;
  body: string;
  image_path: string | null;
  created_at: string;
};

export async function listArtistReviews(artistId: string, viewerUserId: string | null): Promise<Review[]> {
  if (!UUID.test(artistId)) return [];
  const { data, error } = await db()
    .from("artist_reviews")
    .select("id, user_id, author_name, body, image_path, created_at")
    .eq("artist_id", artistId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .returns<Row[]>();
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    authorName: r.author_name,
    body: r.body,
    hasImage: !!r.image_path,
    createdAt: r.created_at,
    mine: !!viewerUserId && r.user_id === viewerUserId,
  }));
}

export async function reviewCount(artistId: string): Promise<number> {
  if (!UUID.test(artistId)) return 0;
  const { count, error } = await db()
    .from("artist_reviews")
    .select("*", { count: "exact", head: true })
    .eq("artist_id", artistId)
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
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
  const artist = await db()
    .from("artists")
    .select("user_id, status")
    .eq("user_id", input.artistId)
    .maybeSingle<{ user_id: string; status: string }>();
  if (artist.error) throw artist.error;
  if (!artist.data || artist.data.status !== "approved") throw new ReviewError("not_found");
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

  const { data, error } = await db()
    .from("artist_reviews")
    .insert({
      artist_id: input.artistId,
      user_id: input.userId,
      author_name: input.authorName,
      body,
      image_path: imagePath,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

// 작성자 본인 또는 어드민만. soft delete.
export async function deleteReview(id: string, userId: string, isAdmin: boolean): Promise<void> {
  if (!UUID.test(id)) throw new ReviewError("not_found");
  const { data, error } = await db()
    .from("artist_reviews")
    .select("user_id, deleted_at")
    .eq("id", id)
    .maybeSingle<{ user_id: string; deleted_at: string | null }>();
  if (error) throw error;
  if (!data || data.deleted_at) throw new ReviewError("not_found");
  if (!isAdmin && data.user_id !== userId) throw new ReviewError("forbidden");
  const { error: delError } = await db()
    .from("artist_reviews")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (delError) throw delError;
}

// 이미지 서빙용: 후기의 image_path(없으면 null).
export async function reviewImageOf(id: string): Promise<string | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await db()
    .from("artist_reviews")
    .select("image_path")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<{ image_path: string | null }>();
  if (error) throw error;
  return data?.image_path ?? null;
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
  const { data, error } = await db()
    .from("artist_reviews")
    .select("id, author_name, body, image_path, created_at, artists(handle, display_name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<(Row & { artists: { handle: string; display_name: string } | null })[]>();
  if (error) throw error;
  return data
    .filter((r) => r.artists)
    .map((r) => ({
      id: r.id,
      authorName: r.author_name,
      body: r.body,
      hasImage: !!r.image_path,
      createdAt: r.created_at,
      artistHandle: r.artists!.handle,
      artistName: r.artists!.display_name,
    }));
}
