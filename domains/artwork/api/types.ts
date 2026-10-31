// ---------------------------------------------------------------------------
// Server 타입(wire) ↔ Client 타입(UI) 분리.
//
// Server*  = 백엔드가 내려주는 그대로의 모양. 바뀌면 여기만 고친다.
// Client   = 화면이 쓰기 좋은 모양. 변환은 transform.ts가 담당.
// 이렇게 분리해 두면 백엔드 응답이 바뀌어도 UI/훅은 영향받지 않는다.
// ---------------------------------------------------------------------------

export type ArtworkFormat = "regular" | "jumbo" | "nine_pocket" | "etc";

// ── Server (wire) ──────────────────────────────────────────────────────────

export type ServerArtworkCard = {
  setCode: string;
  collectorNumber: string;
  nameKo: string;
};

export type ServerArtworkItem = {
  artworkId: string;
  title: string;
  artistName: string;
  artistHandle: string | null;
  format: ArtworkFormat;
  card: ServerArtworkCard;
  thumbnailUrl: string | null;
  membersOnly: boolean;
  printSizeVerified: boolean;
  stats: { recommendCount: number };
  me: { isRecommended: boolean };
  createdAt: string;
};

export type ServerArtworkDetail = ServerArtworkItem & {
  sourceUrl: string | null;
  pieceCount: number;
  positions: number[];
};

export type ServerArtworksResponse = {
  items: ServerArtworkItem[];
  nextCursor: ServerArtworkCursor | null;
  hasNext: boolean;
};

export type ServerArtworkCursor = { lastId: string; lastSortOrder: number };

export type ServerRecommendResult = {
  recommended: boolean;
  recommendCount: number;
};

// ── Client (UI) ─────────────────────────────────────────────────────────────

export type ArtworkCard = {
  /** "sv2a 201/165" */
  label: string;
  /** 카드 상세 경로 */
  path: string;
  name: string;
};

export type Artwork = {
  id: string;
  title: string;
  artistName: string;
  artistHandle: string | null;
  format: ArtworkFormat;
  card: ArtworkCard;
  thumbnailUrl: string | null;
  membersOnly: boolean;
  printSizeVerified: boolean;
  recommendCount: number;
  isRecommended: boolean;
  createdAt: string;
};

export type ArtworkDetail = Artwork & {
  sourceUrl: string | null;
  sourceDomain: string | null;
  pieceCount: number;
  positions: number[];
};

export type ArtworkCursor = { lastId: string; lastSortOrder: number };

export type ArtworksData = {
  items: Artwork[];
  nextCursor: ArtworkCursor | null;
  hasNext: boolean;
};
