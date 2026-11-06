export type UploadArea = "/api/admin" | "/api/artist";

export type AdminCardHit = {
  cardId: string;
  label: string;
  name: string;
  setName: string;
  rarity: string | null;
  imagePath: string | null;
  lang: "ko" | "ja";
};

export type UpdateArtworkResult = { changed?: boolean; purged?: boolean };
export type CreateArtworkResult = { id: string };
export type AttachFileInput = { kind: "original" | "thumbnail"; uploadId: string };
