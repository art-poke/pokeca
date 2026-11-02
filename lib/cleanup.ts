import "server-only";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { artworkFiles, artworks, consentEvents, reportThrottle } from "@/lib/db/schema";
import { storageClient } from "@/lib/storage-client";
import { BUCKET, EVIDENCE_BUCKET, removeFiles } from "@/lib/storage";

// 하루 한 번 도는 정리 작업 (eng D4, D9). Vercel Cron이 /api/cron/cleanup을 부른다.
//   1. 24시간 지난 pending/ 업로드 (확정 전에 탭을 닫은 경우)
//   2. artworks/ 아래 24시간 지난 파일 중 artwork_files 행이 없는 것
//      (이동 후 행 생성 실패, 교체·허락 하향 뒤 삭제 실패, 철회 작품에 옮겨진 파일)
//   3. 철회됐는데 files_purged = false인 작품의 파일 (커밋 후 삭제 실패)
//   4. 24시간 지난 신고 남용 방지 카운터(report_throttle)
//   5. consent-evidence 버킷: 24시간 지난 pending/, consent_events에 기록되지 않은 artworks/ 파일
//      (확정 후 이벤트 기록 실패). 기록된 근거는 철회 뒤에도 남긴다(허락 이력의 증거).
// Supabase Storage 파일은 SQL로 지울 수 없어서 pg_cron 대신 앱 경로로 돈다.

const PAGE = 1000;

type Listed = { name: string; id: string | null; created_at: string | null };

async function listAll(prefix: string, bucket = BUCKET): Promise<Listed[]> {
  const out: Listed[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await storageClient().from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) throw error;
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

// 추적 중인 경로 집합. 테이블·열을 받아 PAGE 단위로 페이지네이션한다(원래 Supabase .range()와 동일).
type TrackedTable = typeof artworkFiles | typeof consentEvents;
type TrackedColumn = typeof artworkFiles.path | typeof consentEvents.evidencePath;

async function trackedPaths(
  table: TrackedTable = artworkFiles,
  column: TrackedColumn = artworkFiles.path,
): Promise<Set<string>> {
  const out = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const rows = await db
      .select({ path: column })
      .from(table)
      .where(isNotNull(column))
      .orderBy(column)
      .limit(PAGE)
      .offset(from);
    for (const r of rows) if (r.path !== null) out.add(r.path);
    if (rows.length < PAGE) return out;
  }
}

// 버킷의 pending/과 artworks/<작품>/ 아래에서 24시간 지난 파일을 찾는다.
async function staleFiles(bucket: string, cutoff: Date) {
  const pending = (await listAll("pending", bucket))
    .filter((f) => f.id && isOlder(f.created_at, cutoff))
    .map((f) => `pending/${f.name}`);
  const moved: string[] = [];
  for (const folder of (await listAll("artworks", bucket)).filter((f) => !f.id)) {
    for (const f of await listAll(`artworks/${folder.name}`, bucket)) {
      if (f.id && isOlder(f.created_at, cutoff)) moved.push(`artworks/${folder.name}/${f.name}`);
    }
  }
  return { pending, moved };
}

async function remove(bucket: string, paths: string[]) {
  if (!paths.length) return;
  const { error } = await storageClient().from(bucket).remove(paths);
  if (error) throw error;
}

const isOlder = (createdAt: string | null, cutoff: Date) => !!createdAt && new Date(createdAt) < cutoff;

export type CleanupReport = {
  pending: number;
  orphaned: number;
  withdrawn: number;
  throttle: number;
  evidence: number;
};

export async function cleanup(now = new Date()): Promise<CleanupReport> {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 폴더 항목은 id가 null이다. 행 여부는 경로로만 본다(작품 ID를 쿼리에 넣지 않아 수가 늘어도 URL 길이 문제가 없다).
  // 목록을 먼저 읽고 행을 나중에 읽는다: 그 사이 확정된 파일은 행 쪽에 잡혀 지워지지 않는다.
  const files = await staleFiles(BUCKET, cutoff);
  await remove(BUCKET, files.pending);
  const tracked = await trackedPaths();
  const orphaned = files.moved.filter((path) => !tracked.has(path));
  await remove(BUCKET, orphaned);

  const evidenceFiles = await staleFiles(EVIDENCE_BUCKET, cutoff);
  const recorded = await trackedPaths(consentEvents, consentEvents.evidencePath);
  const evidence = [...evidenceFiles.pending, ...evidenceFiles.moved.filter((path) => !recorded.has(path))];
  await remove(EVIDENCE_BUCKET, evidence);

  const leftovers = await db
    .select({ path: artworkFiles.path })
    .from(artworkFiles)
    .innerJoin(artworks, eq(artworkFiles.artworkId, artworks.id))
    .where(and(eq(artworks.status, "withdrawn"), eq(artworks.filesPurged, false)));
  const withdrawn = leftovers.map((f) => f.path);
  await removeFiles(withdrawn);

  const throttleRows = await db
    .delete(reportThrottle)
    .where(lt(reportThrottle.createdAt, cutoff))
    .returning({ id: reportThrottle.id });
  const throttle = throttleRows.length;

  return {
    pending: files.pending.length,
    orphaned: orphaned.length,
    withdrawn: withdrawn.length,
    throttle,
    evidence: evidence.length,
  };
}
