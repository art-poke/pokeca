import { artistRoute } from "@/lib/artist-route";
import { artistActor } from "@/lib/artists";
import { createArtwork, type NewArtwork } from "@/lib/artworks";

// 작가 업로드 2단계: 작품 생성. 작가 이름은 계정의 표시 이름으로 고정하고, 바로 공개한다.
// 본인이 올리는 것이 곧 보관·다운로드 허락이라 허락 근거 파일은 받지 않는다.
export const POST = artistRoute(async (request, _ctx, artist) => {
  const body = await request.json();
  const input: NewArtwork = {
    id: String(body.id),
    cardId: String(body.cardId),
    artistName: artist.displayName,
    artistId: artist.userId,
    title: body.title ? String(body.title) : null,
    format: body.format,
    sourceUrl: body.sourceUrl || null,
    sourceVisibility: body.sourceUrl ? body.sourceVisibility : null,
    printSizeVerified: !!body.printSizeVerified,
  };
  const uploads = body.uploads ?? {};
  // originals는 문자열 또는 {uploadId, position}(9포켓 자리 지정). 그대로 넘기면 createArtwork가 정규화한다.
  const id = await createArtwork(
    input,
    {
      originals: Array.isArray(uploads.originals) ? uploads.originals : undefined,
      original: uploads.original,
      thumbnail: uploads.thumbnail,
    },
    artistActor(artist),
  );
  return Response.json({ id }, { status: 201 });
});
