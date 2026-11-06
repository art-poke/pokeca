import { notFound, redirect } from "next/navigation";
import { ArtworkEditForm } from "@/components/artwork-edit-form";
import { currentArtist, getMyArtwork } from "@/lib/artists";

export const metadata = { title: "도안 수정 · Extended Art Archive" };

export default async function EditArtworkPage(props: PageProps<"/artworks/[id]/edit">) {
  const { id } = await props.params;
  const artist = await currentArtist();
  if (!artist) redirect("/artist/login");
  const art = await getMyArtwork(artist, id);
  if (!art) notFound(); // 내 도안이 아니거나 내려간 도안
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">도안 수정</h1>
        <p className="tabular mt-1 text-sm text-muted-foreground">
          {art.card.label} {art.card.name}
        </p>
      </div>
      <ArtworkEditForm art={art} />
    </div>
  );
}
