import "server-only";
import { and, asc, desc, eq, ilike, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  artists,
  artworkFiles,
  artworks,
  cards,
  consentEvents,
  reports,
} from "@/lib/db/schema";
import { ArtworkError, type Format, type Status } from "@/lib/artworks";
import { signedEvidenceUrl } from "@/lib/storage";
import { UUID } from "@/lib/uuid";

// 어드민 화면 조회와 간단한 기록 (design 11A, eng E6·E7). 호출자는 currentAdmin()을 먼저 확인한다.

export const LINK_STATUSES = ["unchecked", "ok", "deleted", "no_access", "suspect"] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];
export const CHECK_INTERVAL_DAYS = 7;

export type AdminArtworkRow = {
  id: string;
  setCode: string;
  collectorNumber: string;
  artistName: string;
  format: Format;
  status: Status;
  sourceUrl: string | null;
  sourceVisibility: "public" | "members_only" | null;
  linkStatus: LinkStatus;
  linkCheckedAt: string | null;
  needsCheck: boolean;
  createdAt: string;
};

type Row = {
  id: string;
  artist_name: string;
  format: Format;
  status: Status;
  source_url: string | null;
  source_visibility: "public" | "members_only" | null;
  link_status: LinkStatus;
  link_checked_at: string | null;
  created_at: string;
  cards: { set_code: string; collector_number: string };
};

// artworks + cards 조인에서 Row 형태로 뽑는 공통 select. (옛 PostgREST COLUMNS 상수의 Drizzle판.)
const artworkRowColumns = {
  id: artworks.id,
  artist_name: artworks.artistName,
  format: artworks.format,
  status: artworks.status,
  source_url: artworks.sourceUrl,
  source_visibility: artworks.sourceVisibility,
  link_status: artworks.linkStatus,
  link_checked_at: artworks.linkCheckedAt,
  created_at: artworks.createdAt,
  set_code: cards.setCode,
  collector_number: cards.collectorNumber,
} as const;

type ArtworkRowSelect = {
  id: string;
  artist_name: string;
  format: string;
  status: string;
  source_url: string | null;
  source_visibility: string | null;
  link_status: string;
  link_checked_at: Date | null;
  created_at: Date;
  set_code: string;
  collector_number: string;
};

// Drizzle 평평한 결과(날짜는 Date, 문자열 enum)를 toAdminRow가 받는 Row로 맞춘다.
function toRow(r: ArtworkRowSelect): Row {
  return {
    id: r.id,
    artist_name: r.artist_name,
    format: r.format as Format,
    status: r.status as Status,
    source_url: r.source_url,
    source_visibility: r.source_visibility as "public" | "members_only" | null,
    link_status: r.link_status as LinkStatus,
    link_checked_at: r.link_checked_at ? r.link_checked_at.toISOString() : null,
    created_at: r.created_at.toISOString(),
    cards: { set_code: r.set_code, collector_number: r.collector_number },
  };
}

// 점검 필요 = 원본 링크가 있고, 7일 넘게 점검 안 했거나 의심 표시 (eng E6).
export function needsCheck(r: { source_url: string | null; status: Status; link_status: LinkStatus; link_checked_at: string | null }, now = new Date()) {
  if (!r.source_url || r.status === "withdrawn") return false;
  if (r.link_status === "suspect" || !r.link_checked_at) return true;
  return now.getTime() - new Date(r.link_checked_at).getTime() > CHECK_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
}

function toAdminRow(r: Row, now: Date): AdminArtworkRow {
  return {
    id: r.id,
    setCode: r.cards.set_code,
    collectorNumber: r.cards.collector_number,
    artistName: r.artist_name,
    format: r.format,
    status: r.status,
    sourceUrl: r.source_url,
    sourceVisibility: r.source_visibility,
    linkStatus: r.link_status,
    linkCheckedAt: r.link_checked_at,
    needsCheck: needsCheck(r, now),
    createdAt: r.created_at,
  };
}

export type ArtworkFilter = { status?: Status; linkStatus?: LinkStatus; needsCheck?: boolean };

// 작품 수가 수백 개 수준이라 한 번에 읽고 서버에서 거른다. 점검 필요가 먼저, 그 안에서 최신 순.
export async function listAdminArtworks(filter: ArtworkFilter = {}, now = new Date()): Promise<AdminArtworkRow[]> {
  const conds = [
    filter.status ? eq(artworks.status, filter.status) : undefined,
    filter.linkStatus ? eq(artworks.linkStatus, filter.linkStatus) : undefined,
  ].filter(Boolean);
  const data = await db
    .select(artworkRowColumns)
    .from(artworks)
    .innerJoin(cards, eq(artworks.cardId, cards.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(artworks.createdAt))
    .limit(1000);
  const rows = data.map((r) => toAdminRow(toRow(r), now));
  return (filter.needsCheck ? rows.filter((r) => r.needsCheck) : rows).sort(
    (a, b) => Number(b.needsCheck) - Number(a.needsCheck),
  );
}

// plpgsql의 raise exception '<code>' 메시지를 cause 체인에서 찾아 ArtworkError로 매핑한다.
const LINK_STATUS_ERRORS = ["not_found", "invalid_link_status"];

function linkStatusError(e: unknown): never {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = e;
  for (let i = 0; i < 5 && cur; i++) {
    if (typeof cur.message === "string" && LINK_STATUS_ERRORS.includes(cur.message)) {
      throw new ArtworkError(cur.message);
    }
    cur = cur.cause;
  }
  throw e;
}

export async function setLinkStatus(id: string, status: LinkStatus): Promise<void> {
  try {
    await db.execute(sql`select public.artwork_set_link_status(${id}::uuid, ${status})`);
  } catch (e) {
    linkStatusError(e);
  }
}

export type ConsentEvent = {
  id: number;
  kind: "created" | "status" | "consent";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  evidencePath: string | null;
  actor: string;
  createdAt: string;
};

export type AdminArtworkDetail = AdminArtworkRow & {
  cardName: string;
  artistAccount: { handle: string; status: string } | null; // 작가가 직접 올린 작품
  printSizeVerified: boolean;
  files: { kind: "original" | "thumbnail"; mimeType: string; sizeBytes: number }[];
  events: ConsentEvent[];
  reports: { id: string; reason: string; status: string; createdAt: string }[];
};

export async function getAdminArtwork(id: string, now = new Date()): Promise<AdminArtworkDetail | null> {
  if (!UUID.test(id)) return null;
  // 옛 PostgREST의 중첩 임베드를 작품 1건 + 관련 테이블 각각의 쿼리로 나눈다.
  const base = await db
    .select({
      ...artworkRowColumns,
      name_ko: cards.nameKo,
      print_size_verified: artworks.printSizeVerified,
      artist_handle: artists.handle,
      artist_status: artists.status,
    })
    .from(artworks)
    .innerJoin(cards, eq(artworks.cardId, cards.id))
    .leftJoin(artists, eq(artworks.artistId, artists.userId))
    .where(eq(artworks.id, id))
    .limit(1);
  const data = base[0];
  if (!data) return null;

  const [files, events, reportRows] = await Promise.all([
    db
      .select({ kind: artworkFiles.kind, mimeType: artworkFiles.mimeType, sizeBytes: artworkFiles.sizeBytes })
      .from(artworkFiles)
      .where(eq(artworkFiles.artworkId, id)),
    db
      .select({
        id: consentEvents.id,
        kind: consentEvents.kind,
        before: consentEvents.before,
        after: consentEvents.after,
        reason: consentEvents.reason,
        evidence_path: consentEvents.evidencePath,
        actor: consentEvents.actor,
        created_at: consentEvents.createdAt,
      })
      .from(consentEvents)
      .where(eq(consentEvents.artworkId, id)),
    db
      .select({
        id: reports.id,
        reason: reports.reason,
        status: reports.status,
        created_at: reports.createdAt,
      })
      .from(reports)
      .where(eq(reports.artworkId, id)),
  ]);

  return {
    ...toAdminRow(toRow(data), now),
    cardName: data.name_ko,
    artistAccount: data.artist_handle ? { handle: data.artist_handle, status: data.artist_status ?? "" } : null,
    printSizeVerified: data.print_size_verified,
    files: files.map((f) => ({
      kind: f.kind as "original" | "thumbnail",
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
    })),
    events: events
      .map((e) => ({
        id: e.id,
        kind: e.kind as ConsentEvent["kind"],
        before: e.before as Record<string, unknown> | null,
        after: e.after as Record<string, unknown> | null,
        reason: e.reason,
        evidencePath: e.evidence_path,
        actor: e.actor ?? "",
        createdAt: e.created_at.toISOString(),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id),
    reports: reportRows
      .map((r) => ({ id: r.id, reason: r.reason, status: r.status, createdAt: r.created_at.toISOString() }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

// 허락 근거 (설계 R3). 이벤트 ID로만 찾는다: 기록된 경로만 서명하고 임의 경로는 받지 않는다.
export async function evidenceUrl(eventId: string): Promise<string | null> {
  if (!/^[1-9]\d{0,17}$/.test(eventId)) return null;
  const rows = await db
    .select({ evidencePath: consentEvents.evidencePath })
    .from(consentEvents)
    .where(eq(consentEvents.id, Number(eventId)))
    .limit(1);
  const path = rows[0]?.evidencePath;
  return path ? signedEvidenceUrl(path) : null;
}

// 신고 (eng E7) ----------------------------------------------------------------

export type ReportStatus = "open" | "resolved" | "no_target";

export type AdminReport = {
  id: string;
  artworkId: string | null;
  artworkLabel: string | null;
  sourceUrl: string | null;
  reason: string;
  contact: string | null;
  message: string | null;
  status: ReportStatus;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export async function listReports(): Promise<AdminReport[]> {
  const reportColumns = {
    id: reports.id,
    artwork_id: reports.artworkId,
    source_url: reports.sourceUrl,
    reason: reports.reason,
    contact: reports.contact,
    message: reports.message,
    status: reports.status,
    resolution_note: reports.resolutionNote,
    resolved_at: reports.resolvedAt,
    created_at: reports.createdAt,
    artwork_artist_name: artworks.artistName,
    artwork_format: artworks.format,
    set_code: cards.setCode,
    collector_number: cards.collectorNumber,
  };
  const [open, closed] = await Promise.all([
    db
      .select(reportColumns)
      .from(reports)
      .leftJoin(artworks, eq(reports.artworkId, artworks.id))
      .leftJoin(cards, eq(artworks.cardId, cards.id))
      .where(eq(reports.status, "open"))
      .orderBy(asc(reports.createdAt)),
    db
      .select(reportColumns)
      .from(reports)
      .leftJoin(artworks, eq(reports.artworkId, artworks.id))
      .leftJoin(cards, eq(artworks.cardId, cards.id))
      .where(ne(reports.status, "open"))
      .orderBy(desc(reports.resolvedAt))
      .limit(20),
  ]);
  return [...open, ...closed].map((r) => ({
    id: r.id,
    artworkId: r.artwork_id,
    artworkLabel:
      r.artwork_id && r.set_code !== null
        ? `${r.set_code} ${r.collector_number} · @${r.artwork_artist_name} · ${r.artwork_format}`
        : null,
    sourceUrl: r.source_url,
    reason: r.reason,
    contact: r.contact,
    message: r.message,
    status: r.status as ReportStatus,
    resolutionNote: r.resolution_note,
    resolvedAt: r.resolved_at ? r.resolved_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
  }));
}

// 작품 없는 신고의 URL로 후보 작품을 찾는다. 쿼리 문자열·해시 차이는 무시한다.
export async function findArtworksBySource(url: string): Promise<AdminArtworkRow[]> {
  let key = url.trim();
  try {
    const u = new URL(key);
    key = `${u.host}${u.pathname}`.replace(/\/$/, "");
  } catch {}
  if (!key) return [];
  const pattern = `%${key.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const data = await db
    .select(artworkRowColumns)
    .from(artworks)
    .innerJoin(cards, eq(artworks.cardId, cards.id))
    .where(ilike(artworks.sourceUrl, pattern))
    .limit(10);
  const now = new Date();
  return data.map((r) => toAdminRow(toRow(r), now));
}

export async function linkReport(reportId: string, artworkId: string): Promise<void> {
  const updated = await db
    .update(reports)
    .set({ artworkId })
    .where(and(eq(reports.id, reportId), eq(reports.status, "open")))
    .returning({ id: reports.id });
  if (!updated.length) throw new ArtworkError("not_found");
}

export async function closeReport(reportId: string, status: Exclude<ReportStatus, "open">, note: string): Promise<void> {
  const updated = await db
    .update(reports)
    .set({ status, resolutionNote: note.trim() || null, resolvedAt: new Date() })
    .where(and(eq(reports.id, reportId), eq(reports.status, "open")))
    .returning({ id: reports.id });
  if (!updated.length) throw new ArtworkError("not_found");
}
