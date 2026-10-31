import type { PortfolioArtwork } from "@/lib/artists";
import { ArtworkItem } from "./ArtworkItem";

// 작가 페이지의 도안 그리드. 타일마다 카드 번호를 붙이고, 클릭하면 도안 상세로 간다.
export function ArtistGallery({ artworks }: { artworks: PortfolioArtwork[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="도안">
      {artworks.map((a) => (
        <ArtworkItem key={a.id} artwork={a} card={a.card} />
      ))}
    </ul>
  );
}
