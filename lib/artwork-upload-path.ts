import { UUID } from "./uuid";

export function artworkUploadCardId(value: unknown): string | undefined {
  return typeof value === "string" && UUID.test(value) ? value : undefined;
}

export function artworkUploadPath(cardId: string): string {
  return `/artist/new?cardId=${encodeURIComponent(cardId)}`;
}
