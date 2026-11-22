import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NewArtworkForm } from "@/components/admin/NewArtworkForm";
import { HandleSetup } from "@/components/handle-setup";
import { SpecInfoButton } from "@/components/spec-info";
import { currentArtist } from "@/lib/artists";
import { artworkUploadCardId } from "@/lib/artwork-upload-path";
import { getCardById } from "@/lib/cards";

export const metadata = { title: "도안 올리기 · Extended Art Archive" };

export default function NewArtistArtworkPage({ searchParams }: PageProps<"/artist/new">) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold text-foreground">도안 올리기</h1>
        <SpecInfoButton />
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-gray-100" />}>
        <Gate searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// 발행 자격(handle 보유)만. handle 없으면 마이페이지로 튕기지 말고 여기서 바로 설정하게 한다.
// dev에서는 로그인 없이도 폼 UI를 미리본다(카드 검색·업로드는 로그인 후).
async function Gate({ searchParams }: Pick<PageProps<"/artist/new">, "searchParams">) {
  const [artist, query] = await Promise.all([currentArtist(), searchParams]);
  const cardId = artworkUploadCardId(query.cardId);
  if (!artist && process.env.NODE_ENV !== "development") {
    redirect(cardId ? `/artist/login?cardId=${cardId}` : "/artist/login");
  }
  if (artist && !artist.handle) return <HandleSetup displayName={artist.displayName} />;

  const card = cardId ? await getCardById(cardId) : null;
  const initialCard = card ? {
    cardId: card.cardId,
    label: `${card.setCode} ${card.collectorNumber}`,
    name: card.nameKo,
    setName: card.setName,
    rarity: card.rarity,
    imagePath: card.imagePath,
    lang: card.lang,
  } : null;

  if (!artist) {
    return (
      <>
        <p className="rounded-xl bg-accent px-4 py-2.5 text-sm text-accent-foreground">
          미리보기 모드예요 — 카드 검색·업로드는 로그인 후 동작해요.
        </p>
        <NewArtworkForm key={cardId} mode="artist" initialCard={initialCard} />
      </>
    );
  }
  return <NewArtworkForm key={cardId} mode="artist" initialCard={initialCard} />;
}
