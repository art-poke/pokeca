export type UploadArea = "/api/admin" | "/api/artist";

export type AdminCardHit = {
  cardId: string;
  label: string;
  name: string;
  setName: string;
};

export type UpdateArtworkResult = { changed?: boolean; purged?: boolean };
export type CreateArtworkResult = { id: string };
export type AttachFileInput = { kind: "original" | "thumbnail"; uploadId: string };
