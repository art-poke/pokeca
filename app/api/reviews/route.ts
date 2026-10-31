import { approvedArtistId } from "@/lib/artists";
import { memberRoute } from "@/lib/member-route";
import { createReview, ReviewError } from "@/lib/reviews";

// 작가 후기 작성. body: { artistHandle, body, imageUploadId? }. 회원만.
export const POST = memberRoute(async (request, _ctx, member) => {
  const body = await request.json();
  const handle = String(body.artistHandle ?? "");
  const artistId = await approvedArtistId(handle);
  if (!artistId) throw new ReviewError("not_found");
  const id = await createReview({
    artistId,
    userId: member.userId,
    authorName: member.displayName,
    body: String(body.body ?? ""),
    imageUploadId: body.imageUploadId ? String(body.imageUploadId) : null,
  });
  return Response.json({ id }, { status: 201 });
});
