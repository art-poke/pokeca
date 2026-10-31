import Image from "next/image";
import Link from "next/link";
import type { Artwork } from "@/domains/artwork/api/types";

// 순수 표현 컴포넌트(데이터/로직 없음). 목록·상세 어디서나 재사용.
export const ArtworkCard = ({ artwork }: { artwork: Artwork }) => (
  <Link
    href={`/artworks/${artwork.id}`}
    className="group block overflow-hidden rounded-2xl border border-border bg-background"
  >
    <div className="relative aspect-[3/4] bg-gray-100">
      {artwork.thumbnailUrl && (
        <Image
          src={artwork.thumbnailUrl}
          alt={artwork.title}
          fill
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover transition-transform group-hover:scale-105"
        />
      )}
    </div>
    <div className="space-y-1 p-3">
      <p className="truncate text-sm font-semibold text-foreground">{artwork.title}</p>
      <p className="truncate text-xs text-ink-500">{artwork.artistName}</p>
      <div className="flex items-center justify-between pt-1 text-xs text-ink-400">
        <span className="truncate">{artwork.card.label}</span>
        <span>추천 {artwork.recommendCount}</span>
      </div>
    </div>
  </Link>
);
