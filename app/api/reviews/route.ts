import { recordActivity } from "@/lib/analytics/write";
import { publishedArtistId } from "@/lib/artists";
import { memberRoute } from "@/lib/artist-route";
import { createReview, ReviewError } from "@/lib/reviews";

// 작가 후기 작성. body: { artistHandle, body, imageUploadId? }. 회원만.
export const POST = memberRoute(async (request, _ctx, member) => {
  const body = await request.json();
  const handle = String(body.artistHandle ?? "");
  const artistId = await publishedArtistId(handle);
  if (!artistId) throw new ReviewError("not_found");
  const id = await createReview({
    artistId,
    userId: member.userId,
    authorName: member.displayName,
    body: String(body.body ?? ""),
    imageUploadId: body.imageUploadId ? String(body.imageUploadId) : null,
  });
  await recordActivity("review_created",member.userId,{id});
  return Response.json({ id }, { status: 201 });
});
