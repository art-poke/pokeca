import "server-only";
import { db } from "@/lib/supabase/server";
import {
  EXTENSION,
  promoteEvidence,
  promoteUpload,
  readFile,
  removeFiles,
  signedDownloadUrl,
  signedViewUrl,
  StorageInputError,
  type FileKind,
  type MimeType,
  type StoredFile,
} from "@/lib/storage";
import { FORMATS, type Format } from "@/lib/formats";
import { makePreview, PreviewError } from "@/lib/preview";
import { buildZip } from "@/lib/zip";
import { UUID } from "@/lib/uuid";

// 작품의 생성·상태 변경·허락 근거 기록은 이 모듈만 한다 (eng D5, D9, D10).
// 모든 작품은 사이트에 보관한다: 원본 + 미리보기(20261029090000_archive_only.sql).
// 전이 규칙과 consent_events 기록은 DB 함수(artwork_functions.sql)가 한 트랜잭션에서 처리하고,
// 여기서는 커밋 뒤에 파일을 지운다. 삭제가 실패해도 DB가 기준이라 방문자에게는 이미 410이고,
// 남은 파일은 정리 작업(cleanup)이 다시 지운다.

export { FORMATS, type Format } from "@/lib/formats";
export type Status = "active" | "hidden" | "withdrawn";

export class ArtworkError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const DB_ERROR_CODES = [
  "not_found",
  "withdrawn_is_final",
  "invalid_status",
  "original_required",
  "thumbnail_required",
  "evidence_required",
];

function rethrow(error: { message: string }): never {
  if (DB_ERROR_CODES.includes(error.message)) throw new ArtworkError(error.message);
  throw error;
}

async function purgeAfterCommit(paths: string[]): Promise<boolean> {
  try {
    await removeFiles(paths);
    return true;
  } catch (e) {
    console.error("file purge failed; cleanup will retry", paths, e);
    return false;
  }
}

// 생성 ----------------------------------------------------------------------

export type NewArtwork = {
  id: string; // 어드민 폼이 만든 UUID. 재시도해도 같은 작품이 된다.
  cardId: string;
  artistName: string;
  format: Format;
  sourceUrl: string | null;
  sourceVisibility: "public" | "members_only" | null;
  printSizeVerified: boolean;
  artistId?: string | null; // 작가 계정이 직접 올린 작품이면 그 계정(lib/artists)
  title?: string | null; // 도안 제목(작가 입력). 없으면 "{작가}님의 도안"으로 표시.
};

function storageError(e: unknown): never {
  if (e instanceof StorageInputError || e instanceof PreviewError) throw new ArtworkError(e.message);
  throw e;
}

// 원본은 필수다. 미리보기를 따로 올리지 않았으면 원본에서 만든다(PDF 원본은 직접 올려야 한다).
// uploads.evidence는 허락 근거 업로드 ID. 경로는 서버가 정한다(클라이언트가 보낸 경로는 받지 않는다).
export async function createArtwork(
  input: NewArtwork,
  // originals: 조각 여러 장. 문자열이면 순서대로 position 0,1,2…, {uploadId,position}면 그 자리(9포켓 빈칸 포함)에.
  // original/thumbnail: 단일(기존 호환). thumbnail은 position 0 조각의 미리보기로 쓴다.
  uploads: {
    originals?: (string | { uploadId: string; position: number })[];
    original?: string;
    thumbnail?: string;
    evidence?: string;
  },
  actor: string,
): Promise<string> {
  if (!input.artistName.trim()) throw new ArtworkError("artist_required");
  if (!FORMATS.includes(input.format)) throw new ArtworkError("invalid_format");
  if (input.sourceUrl && !/^https?:\/\//.test(input.sourceUrl)) throw new ArtworkError("invalid_source_url");
  if (!!input.sourceUrl !== !!input.sourceVisibility) throw new ArtworkError("source_visibility_required");
  if (!UUID.test(input.id)) throw new ArtworkError("invalid_id");

  // {uploadId, position}로 정규화. 문자열은 들어온 순서를 position으로 쓴다.
  const pieces = uploads.originals?.length
    ? uploads.originals.map((o, i) =>
        typeof o === "string"
          ? { uploadId: o, position: i }
          : { uploadId: String(o.uploadId), position: Math.max(0, Math.trunc(Number(o.position) || 0)) },
      )
    : uploads.original
      ? [{ uploadId: uploads.original, position: 0 }]
      : [];
  if (pieces.length === 0) throw new ArtworkError("original_required");
  // position이 겹치면 유니크 제약에 걸린다. 미리 막는다.
  if (new Set(pieces.map((p) => p.position)).size !== pieces.length) {
    throw new ArtworkError("duplicate_position");
  }

  const files: (StoredFile & { position: number })[] = [];
  let evidencePath: string | null = null;
  try {
    for (const p of pieces) {
      const original = await promoteUpload(p.uploadId, input.id, "original");
      files.push({ ...original, position: p.position });
      // 단일 original + 직접 올린 thumbnail(PDF 원본용)만 미리보기를 받고, 나머지는 원본에서 만든다.
      const thumb =
        uploads.thumbnail && p.position === 0 && pieces.length === 1
          ? await promoteUpload(uploads.thumbnail, input.id, "thumbnail")
          : await makePreview(input.id, original);
      files.push({ ...thumb, position: p.position });
    }
    if (uploads.evidence) evidencePath = await promoteEvidence(uploads.evidence, input.id);
  } catch (e) {
    storageError(e);
  }

  const { data, error } = await db().rpc("artwork_create", {
    p_artwork: {
      id: input.id,
      card_id: input.cardId,
      artist_name: input.artistName.trim(),
      artist_id: input.artistId ?? null,
      format: input.format,
      source_url: input.sourceUrl,
      source_visibility: input.sourceVisibility,
      print_size_verified: input.printSizeVerified,
      evidence_path: evidencePath,
    },
    p_files: files.map((f) => ({
      kind: f.kind,
      path: f.path,
      mime_type: f.mimeType,
      size_bytes: f.sizeBytes,
      position: f.position,
    })),
    p_actor: actor,
  });
  if (error) rethrow(error);
  const newId = data as string;
  // 제목은 작가 입력(선택). rpc는 건드리지 않고 생성 직후 반영한다.
  const title = input.title?.trim();
  if (title) {
    const { error: titleError } = await db().from("artworks").update({ title }).eq("id", newId);
    if (titleError) console.error("artwork title update", titleError);
  }
  // 이 카드×규격의 미해결 도안 요청을 해결 처리한다(작가면 resolved_by에 기록).
  try {
    const { resolveRequests } = await import("@/lib/art-requests");
    await resolveRequests(input.cardId, input.format, input.artistId ?? null);
  } catch (e) {
    console.error("resolveRequests", e);
  }
  return newId;
}

// 상태·허락 ------------------------------------------------------------------

type ChangeResult = { changed: boolean; purged: boolean };

export async function setStatus(
  id: string,
  to: Status,
  opts: { reason?: string; actor: string },
): Promise<ChangeResult> {
  const { data, error } = await db().rpc("artwork_set_status", {
    p_id: id,
    p_to: to,
    p_reason: opts.reason ?? null,
    p_actor: opts.actor,
  });
  if (error) rethrow(error);
  const { changed, purge_paths } = data as { changed: boolean; purge_paths: string[] };
  return { changed, purged: await purgeAfterCommit(purge_paths) };
}

// 허락 근거(DM 캡처 등)를 나중에 덧붙인다. 경로는 서버가 정한다.
export async function addEvidence(
  id: string,
  evidenceUploadId: string,
  opts: { reason?: string; actor: string },
): Promise<void> {
  if (!UUID.test(id)) throw new ArtworkError("not_found");
  if (!evidenceUploadId) throw new ArtworkError("evidence_required");
  let evidencePath = "";
  try {
    evidencePath = await promoteEvidence(evidenceUploadId, id);
  } catch (e) {
    storageError(e);
  }
  const { error } = await db().rpc("artwork_add_evidence", {
    p_id: id,
    p_reason: opts.reason ?? null,
    p_actor: opts.actor,
    p_evidence_path: evidencePath,
  });
  if (error) rethrow(error);
}

export async function attachFile(id: string, kind: FileKind, uploadId: string): Promise<void> {
  if (!UUID.test(id)) throw new ArtworkError("not_found");
  if (kind !== "original" && kind !== "thumbnail") throw new ArtworkError("invalid_kind");
  // 파일을 옮기기 전에 확인한다. 철회 작품에 옮긴 파일은 추적되지 않는다(정리 작업이 지우긴 한다).
  const { data: target, error: targetError } = await db().from("artworks").select("status").eq("id", id).maybeSingle();
  if (targetError) throw targetError;
  if (!target) throw new ArtworkError("not_found");
  if (target.status === "withdrawn") throw new ArtworkError("withdrawn_is_final");
  // 원본을 바꾸면 미리보기도 새 원본에서 다시 만든다. PDF 원본이면 기존 미리보기를 둔다.
  const files: StoredFile[] = [];
  try {
    const file = await promoteUpload(uploadId, id, kind);
    files.push(file);
    if (kind === "original" && file.mimeType !== "application/pdf") files.push(await makePreview(id, file));
  } catch (e) {
    storageError(e);
  }
  for (const file of files) {
    const { data, error } = await db().rpc("artwork_attach_file", {
      p_id: id,
      p_kind: file.kind,
      p_path: file.path,
      p_mime_type: file.mimeType,
      p_size_bytes: file.sizeBytes,
    });
    if (error) rethrow(error);
    await purgeAfterCommit((data as { purge_paths: string[] }).purge_paths);
  }
}

// 공개 목록 -------------------------------------------------------------------

// 공개 DTO (eng D6). 모든 작품은 미리보기 타일 + 크게 보기 + 다운로드다.
// 원본 글은 출처 표시용 링크다. 사라졌거나 볼 수 없는 글은 링크를 내보내지 않는다.
export type PublicArtwork = {
  id: string;
  title: string;
  artistName: string;
  format: Format;
  sourceUrl: string | null;
  sourceDomain: string | null;
  membersOnly: boolean;
  printSizeVerified: boolean;
  artistHandle: string | null; // 승인된 작가 계정의 작품이면 작가 페이지로 잇는다
};

export type ArtworkRow = {
  id: string;
  title: string | null;
  artist_name: string;
  format: Format;
  source_url: string | null;
  source_visibility: "public" | "members_only" | null;
  link_status: string;
  print_size_verified: boolean;
  artists?: { handle: string; status: string } | null;
};

export function toPublic(r: ArtworkRow): PublicArtwork {
  const sourceUrl = r.link_status === "deleted" || r.link_status === "no_access" ? null : r.source_url;
  let sourceDomain: string | null = null;
  try {
    sourceDomain = sourceUrl ? new URL(sourceUrl).hostname : null;
  } catch {}
  return {
    id: r.id,
    title: r.title?.trim() || `${r.artist_name}님의 도안`,
    artistName: r.artist_name,
    format: r.format,
    sourceUrl,
    sourceDomain,
    membersOnly: !!sourceUrl && r.source_visibility === "members_only",
    printSizeVerified: r.print_size_verified,
    artistHandle: r.artists?.status === "approved" ? r.artists.handle : null,
  };
}

// 최신 등록 순.
export async function listPublicArtworks(cardId: string): Promise<PublicArtwork[]> {
  const { data, error } = await db()
    .from("artworks")
    .select(
      "id, title, artist_name, format, source_url, source_visibility, link_status, print_size_verified, artists(handle, status)",
    )
    .eq("card_id", cardId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .returns<ArtworkRow[]>();
  if (error) throw error;
  return data.map(toPublic);
}

export type RecentArtwork = PublicArtwork & { card: { label: string; path: string; name: string } };

// 홈: 최근 올라온 공개 도안(전체 카드 통틀어 최신 순). 카드 정보도 함께.
export async function recentArtworks(limit = 8): Promise<RecentArtwork[]> {
  const { data, error } = await db()
    .from("artworks")
    .select(
      "id, title, artist_name, format, source_url, source_visibility, link_status, print_size_verified, artists(handle, status), cards(set_code, collector_number, name_ko)",
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<(ArtworkRow & { cards: { set_code: string; collector_number: string; name_ko: string } })[]>();
  if (error) throw error;
  return data.map((r) => ({
    ...toPublic(r),
    card: {
      label: `${r.cards.set_code} ${r.cards.collector_number}`,
      path: `/cards/${encodeURIComponent(r.cards.set_code)}/${r.cards.collector_number.replace("/", "-")}`,
      name: r.cards.name_ko,
    },
  }));
}

// 도안 상세 페이지 (/artworks/[id]) ---------------------------------------------

export type ArtworkDetail = PublicArtwork & {
  card: { label: string; path: string; name: string };
  recommendCount: number;
  // 원본 조각 수. 9포켓 등 여러 장이면 상세에서 3×3 조립 미리보기를 보여 준다.
  pieceCount: number;
  // 조각이 실제로 들어간 자리(9포켓은 0~7, 빈칸은 빠진다). 3×3 배치에 쓴다.
  positions: number[];
};

export async function getArtworkDetail(id: string): Promise<ArtworkDetail | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await db()
    .from("artworks")
    .select(
      "id, title, artist_name, format, source_url, source_visibility, link_status, print_size_verified, artists(handle, status), cards(set_code, collector_number, name_ko), artwork_files(kind, position)",
    )
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle<
      ArtworkRow & {
        cards: { set_code: string; collector_number: string; name_ko: string };
        artwork_files: { kind: FileKind; position: number }[];
      }
    >();
  if (error) throw error;
  if (!data) return null;

  // 추천수(순환참조 피하려 inline).
  const { count, error: countError } = await db()
    .from("engagements")
    .select("*", { count: "exact", head: true })
    .eq("artwork_id", id)
    .eq("kind", "recommend");
  if (countError) throw countError;

  return {
    ...toPublic(data),
    card: {
      label: `${data.cards.set_code} ${data.cards.collector_number}`,
      path: `/cards/${encodeURIComponent(data.cards.set_code)}/${data.cards.collector_number.replace("/", "-")}`,
      name: data.cards.name_ko,
    },
    recommendCount: count ?? 0,
    pieceCount: data.artwork_files.filter((f) => f.kind === "original").length,
    positions: data.artwork_files
      .filter((f) => f.kind === "original")
      .map((f) => f.position)
      .sort((a, b) => a - b),
  };
}

// 다운로드·썸네일 ---------------------------------------------------------------

type FileLookup = {
  id: string;
  status: Status;
  artist_name: string;
  format: Format;
  cards: { set_code: string; collector_number: string };
  artwork_files: { kind: FileKind; path: string; mime_type: MimeType; position: number }[];
};

async function lookup(id: string): Promise<FileLookup | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await db()
    .from("artworks")
    .select(
      "id, status, artist_name, format, cards(set_code, collector_number), artwork_files(kind, path, mime_type, position)",
    )
    .eq("id", id)
    .maybeSingle<FileLookup>();
  if (error) throw error;
  return data;
}

export type DownloadResult =
  | { kind: "ok"; url: string } // 단일 조각: 서명 URL로 리다이렉트
  | { kind: "zip"; filename: string; bytes: Uint8Array } // 여러 조각: ZIP으로 묶어 전달
  | { kind: "not_found" } // 404
  | { kind: "unavailable" }; // 410: 숨김·철회 (eng E2)

// 서명 URL/파일은 active 작품에만 발급한다 (eng D10).
// 원본이 여러 장(9포켓 등)이면 ZIP으로 묶어 내려준다.
export async function resolveDownload(id: string): Promise<DownloadResult> {
  const a = await lookup(id);
  if (!a) return { kind: "not_found" };
  const originals = a.artwork_files
    .filter((f) => f.kind === "original")
    .sort((x, y) => x.position - y.position);
  if (a.status !== "active" || originals.length === 0) return { kind: "unavailable" };

  const base = [a.cards.set_code, a.cards.collector_number.replace("/", "-"), a.artist_name, a.format]
    .join("_")
    .replace(/[\\/:*?"<>|\s]+/g, "-");

  if (originals.length === 1) {
    const f = originals[0];
    return { kind: "ok", url: await signedDownloadUrl(f.path, `${base}.${EXTENSION[f.mime_type]}`) };
  }

  const entries = await Promise.all(
    originals.map(async (f, i) => ({
      name: `${base}_${String(i + 1).padStart(2, "0")}.${EXTENSION[f.mime_type]}`,
      data: await readFile(f.path),
    })),
  );
  return { kind: "zip", filename: `${base}.zip`, bytes: buildZip(entries) };
}

// 미리보기 = active. position으로 조각을 고른다(9포켓 3×3 조립용). 없으면 첫 조각.
export async function resolveThumbnail(id: string, position = 0): Promise<string | null> {
  const a = await lookup(id);
  if (!a || a.status !== "active") return null;
  const thumbs = a.artwork_files
    .filter((f) => f.kind === "thumbnail")
    .sort((x, y) => x.position - y.position);
  const thumb = thumbs.find((f) => f.position === position) ?? thumbs[0];
  if (!thumb) return null;
  return signedViewUrl(thumb.path);
}
