"use client";

import Link from "next/link";
import { useArtworkDetailQuery } from "@/domains/artwork/hooks";
import { RecommendButton } from "./recommend-button";

export const ArtworkDetailClient = ({
  id,
  isMember,
}: {
  id: string;
  isMember: boolean;
}) => {
  const { data: artwork, isError, refetch } = useArtworkDetailQuery(id);

  if (isError) {
    return (
      <div className="py-16 text-center text-sm text-ink-500">
        도안을 불러오지 못했어요.
        <button
          type="button"
          onClick={() => refetch()}
          className="ml-2 font-semibold text-foreground underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!artwork) return null; // prefetch로 보통 즉시 채워짐

  return (
    <article className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-foreground">{artwork.title}</h1>
        <p className="text-sm text-ink-500">
          {artwork.artistName}
          {" · "}
          <Link href={artwork.card.path} className="underline">
            {artwork.card.label}
          </Link>
        </p>
      </header>

      <RecommendButton
        id={artwork.id}
        isRecommended={artwork.isRecommended}
        recommendCount={artwork.recommendCount}
        isMember={isMember}
      />

      {artwork.sourceDomain && (
        <p className="text-xs text-ink-400">출처: {artwork.sourceDomain}</p>
      )}
    </article>
  );
};
