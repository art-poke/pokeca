import "server-only";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { artists, artworkFiles, artworks, cards, engagements } from "@/lib/db/schema";
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

// Drizzle는 pg 에러를 감싸 실제 에러를 .cause 체인에 둔다. plpgsql의 `raise exception '<code>'`은
// pg 에러의 message로 올라온다. cause 체인을 따라 그 pg 에러를 찾아 rethrow에 넘긴다.
function dbError(e: unknown): { message: string } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = e;
  for (let i = 0; i < 5 && cur; i++) {
    if (typeof cur.message === "string" && DB_ERROR_CODES.includes(cur.message)) return cur;
    cur = cur.cause;
  }
  // 알려진 코드가 없으면 원래 에러를 그대로 던지도록 바깥쪽 에러를 돌려준다.
  return (e ?? { message: "unknown" }) as { message: string };
}

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

  // 생성·파일·이력 기록은 plpgsql 함수(artwork_create)가 한 트랜잭션에서 처리한다. TS로 재구현하지 않는다.
  const pArtwork = {
    id: input.id,
    card_id: input.cardId,
    artist_name: input.artistName.trim(),
    artist_id: input.artistId ?? null,
    format: input.format,
    source_url: input.sourceUrl,
    source_visibility: input.sourceVisibility,
    print_size_verified: input.printSizeVerified,
    evidence_path: evidencePath,
  };
  const pFiles = files.map((f) => ({
    kind: f.kind,
    path: f.path,
    mime_type: f.mimeType,
    size_bytes: f.sizeBytes,
    position: f.position,
  }));
  let newId: string;
  try {
    const r = await db.execute(
      sql`select public.artwork_create(${JSON.stringify(pArtwork)}::jsonb, ${JSON.stringify(pFiles)}::jsonb, ${actor}) as id`,
    );
    newId = (r.rows[0] as { id: string }).id;
  } catch (e) {
    rethrow(dbError(e));
  }
  // 제목은 작가 입력(선택). rpc는 건드리지 않고 생성 직후 반영한다.
  const title = input.title?.trim();
  if (title) {
    try {
      await db.update(artworks).set({ title }).where(eq(artworks.id, newId));
    } catch (e) {
      console.error("artwork title update", e);
    }
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
  let result: { changed: boolean; purge_paths: string[] };
  try {
    const r = await db.execute(
      sql`select public.artwork_set_status(${id}::uuid, ${to}, ${opts.reason ?? null}, ${opts.actor}) as result`,
    );
    result = (r.rows[0] as { result: { changed: boolean; purge_paths: string[] } }).result;
  } catch (e) {
    rethrow(dbError(e));
  }
  return { changed: result.changed, purged: await purgeAfterCommit(result.purge_paths) };
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
  try {
    await db.execute(
      sql`select public.artwork_add_evidence(${id}::uuid, ${opts.reason ?? null}, ${opts.actor}, ${evidencePath})`,
    );
  } catch (e) {
    rethrow(dbError(e));
  }
}

export async function attachFile(id: string, kind: FileKind, uploadId: string): Promise<void> {
  if (!UUID.test(id)) throw new ArtworkError("not_found");
  if (kind !== "original" && kind !== "thumbnail") throw new ArtworkError("invalid_kind");
  // 파일을 옮기기 전에 확인한다. 철회 작품에 옮긴 파일은 추적되지 않는다(정리 작업이 지우긴 한다).
  const targetRows = await db.select({ status: artworks.status }).from(artworks).where(eq(artworks.id, id)).limit(1);
  const target = targetRows[0] ?? null;
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
    let purgePaths: string[];
    try {
      const r = await db.execute(
        sql`select public.artwork_attach_file(${id}::uuid, ${file.kind}, ${file.path}, ${file.mimeType}, ${file.sizeBytes}) as result`,
      );
      purgePaths = (r.rows[0] as { result: { purge_paths: string[] } }).result.purge_paths;
    } catch (e) {
      rethrow(dbError(e));
    }
    await purgeAfterCommit(purgePaths);
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
  artists?: { handle: string | null } | null;
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
    // 발행자(handle 보유)의 작품이면 작가 페이지로 잇는다.
    artistHandle: r.artists?.handle ?? null,
  };
}

// 최신 등록 순.
export async function listPublicArtworks(cardId: string): Promise<PublicArtwork[]> {
  const rows = await db
    .select({
      id: artworks.id,
      title: artworks.title,
      artist_name: artworks.artistName,
      format: artworks.format,
      source_url: artworks.sourceUrl,
      source_visibility: artworks.sourceVisibility,
      link_status: artworks.linkStatus,
      print_size_verified: artworks.printSizeVerified,
      artistHandle: artists.handle,
    })
    .from(artworks)
    .leftJoin(artists, eq(artworks.artistId, artists.userId))
    .where(and(eq(artworks.cardId, cardId), eq(artworks.status, "active")))
    .orderBy(desc(artworks.createdAt));
  return rows.map((r) => toPublic(toArtworkRow(r)));
}

// Drizzle select 결과(평평한 artistHandle)를 toPublic이 받는 ArtworkRow로 맞춘다.
type ArtworkSelect = {
  id: string;
  title: string | null;
  artist_name: string;
  format: string;
  source_url: string | null;
  source_visibility: string | null;
  link_status: string;
  print_size_verified: boolean;
  artistHandle: string | null;
};

function toArtworkRow(r: ArtworkSelect): ArtworkRow {
  return {
    id: r.id,
    title: r.title,
    artist_name: r.artist_name,
    format: r.format as Format,
    source_url: r.source_url,
    source_visibility: r.source_visibility as "public" | "members_only" | null,
    link_status: r.link_status,
    print_size_verified: r.print_size_verified,
    artists: r.artistHandle ? { handle: r.artistHandle } : null,
  };
}

export type RecentArtwork = PublicArtwork & { card: { label: string; path: string; name: string } };

// 최근 올라온 공개 도안(전체 카드 통틀어 최신 순) 조회. createdAt·id로 정렬해 페이지네이션이 안정적.
async function queryRecentArtworks(limit: number, offset: number): Promise<RecentArtwork[]> {
  const rows = await db
    .select({
      id: artworks.id,
      title: artworks.title,
      artist_name: artworks.artistName,
      format: artworks.format,
      source_url: artworks.sourceUrl,
      source_visibility: artworks.sourceVisibility,
      link_status: artworks.linkStatus,
      print_size_verified: artworks.printSizeVerified,
      artistHandle: artists.handle,
      setCode: cards.setCode,
      collectorNumber: cards.collectorNumber,
      nameKo: cards.nameKo,
    })
    .from(artworks)
    .innerJoin(cards, eq(artworks.cardId, cards.id))
    .leftJoin(artists, eq(artworks.artistId, artists.userId))
    .where(eq(artworks.status, "active"))
    .orderBy(desc(artworks.createdAt), desc(artworks.id))
    .limit(limit)
    .offset(offset);
  return rows.map((r) => ({
    ...toPublic(toArtworkRow(r)),
    card: {
      label: `${r.setCode} ${r.collectorNumber}`,
      path: `/cards/${encodeURIComponent(r.setCode)}/${r.collectorNumber.replace("/", "-")}`,
      name: r.nameKo,
    },
  }));
}

// 홈: 최근 올라온 공개 도안 상위 N개.
export async function recentArtworks(limit = 8): Promise<RecentArtwork[]> {
  return queryRecentArtworks(limit, 0);
}

// "최근 도안 더 보기" 페이지: offset 기반 페이지네이션(무한스크롤). limit+1로 hasMore 판정.
export async function recentArtworksPage(
  opts: { limit?: number; offset?: number } = {},
): Promise<{ artworks: RecentArtwork[]; hasMore: boolean }> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  const rows = await queryRecentArtworks(limit + 1, offset);
  const hasMore = rows.length > limit;
  return { artworks: hasMore ? rows.slice(0, limit) : rows, hasMore };
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
  const rows = await db
    .select({
      id: artworks.id,
      title: artworks.title,
      artist_name: artworks.artistName,
      format: artworks.format,
      source_url: artworks.sourceUrl,
      source_visibility: artworks.sourceVisibility,
      link_status: artworks.linkStatus,
      print_size_verified: artworks.printSizeVerified,
      artistHandle: artists.handle,
      setCode: cards.setCode,
      collectorNumber: cards.collectorNumber,
      nameKo: cards.nameKo,
    })
    .from(artworks)
    .innerJoin(cards, eq(artworks.cardId, cards.id))
    .leftJoin(artists, eq(artworks.artistId, artists.userId))
    .where(and(eq(artworks.id, id), eq(artworks.status, "active")))
    .limit(1);
  const data = rows[0] ?? null;
  if (!data) return null;

  const fileRows = await db
    .select({ kind: artworkFiles.kind, position: artworkFiles.position })
    .from(artworkFiles)
    .where(eq(artworkFiles.artworkId, id));

  // 추천수(순환참조 피하려 inline).
  const countRows = await db
    .select({ n: count() })
    .from(engagements)
    .where(and(eq(engagements.artworkId, id), eq(engagements.kind, "recommend")));
  const recommendCount = countRows[0]?.n ?? 0;

  return {
    ...toPublic(toArtworkRow(data)),
    card: {
      label: `${data.setCode} ${data.collectorNumber}`,
      path: `/cards/${encodeURIComponent(data.setCode)}/${data.collectorNumber.replace("/", "-")}`,
      name: data.nameKo,
    },
    recommendCount,
    pieceCount: fileRows.filter((f) => f.kind === "original").length,
    positions: fileRows
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
  const rows = await db
    .select({
      id: artworks.id,
      status: artworks.status,
      artist_name: artworks.artistName,
      format: artworks.format,
      setCode: cards.setCode,
      collectorNumber: cards.collectorNumber,
    })
    .from(artworks)
    .innerJoin(cards, eq(artworks.cardId, cards.id))
    .where(eq(artworks.id, id))
    .limit(1);
  const a = rows[0];
  if (!a) return null;

  const fileRows = await db
    .select({
      kind: artworkFiles.kind,
      path: artworkFiles.path,
      mime_type: artworkFiles.mimeType,
      position: artworkFiles.position,
    })
    .from(artworkFiles)
    .where(eq(artworkFiles.artworkId, id));

  return {
    id: a.id,
    status: a.status as Status,
    artist_name: a.artist_name,
    format: a.format as Format,
    cards: { set_code: a.setCode, collector_number: a.collectorNumber },
    artwork_files: fileRows.map((f) => ({
      kind: f.kind as FileKind,
      path: f.path,
      mime_type: f.mime_type as MimeType,
      position: f.position,
    })),
  };
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
