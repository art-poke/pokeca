import Image from "next/image";
import Link from "next/link";
import type { Artwork } from "@/domains/artwork/api/types";

// 순수 표현 컴포넌트(데이터/로직 없음). 썸네일은 같은 Next의 /api/thumbnails/[id]가 서빙.
export const ArtworkCard = ({ artwork }: { artwork: Artwork }) => (
  <Link
    href={`/artworks/${artwork.id}`}
    className="group block overflow-hidden rounded-2xl border border-border bg-background"
  >
    <div className="relative aspect-[3/4] bg-gray-100">
      <Image
        src={`/api/thumbnails/${artwork.id}`}
        alt={artwork.title}
        fill
        sizes="(max-width: 640px) 50vw, 25vw"
        className="object-cover transition-transform group-hover:scale-105"
      />
    </div>
    <div className="space-y-1 p-3">
      <p className="truncate text-sm font-semibold text-foreground">{artwork.title}</p>
      <p className="truncate text-xs text-ink-500">{artwork.artistName}</p>
      <p className="truncate pt-1 text-xs text-ink-400">{artwork.card.label}</p>
    </div>
  </Link>
);
