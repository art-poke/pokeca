import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { artworkFiles, artworks, cards, reportThrottle, sets } from "@/lib/db/schema";
import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";

// cleanup.ts의 비스토리지 Drizzle 쿼리 의미(24h report_throttle 삭제, 철회·미정리 작품의 남은 파일 선별,
// trackedPaths 페이지네이션)만 검증한다. 스토리지(listAll/remove) 전체 흐름은 sub D까지 보류.
// 로컬 Docker PG(5432) 자가 시드.

const TAG = `cl${Date.now()}`;
const SET_CODE = `${TAG}set`;

let cardId: string;
let withdrawnPurged: string; // 철회 + files_purged=true → 제외
let withdrawnLeftover: string; // 철회 + files_purged=false → 선별됨
let activeArt: string; // active → 제외
let freshThrottle: number;
let staleThrottle: number;

beforeAll(async () => {
  await db.insert(sets).values({ code: SET_CODE, nameKo: `${TAG} 세트` });
  [{ id: cardId }] = await db
    .insert(cards)
    .values({ setCode: SET_CODE, collectorNumber: "050/165", nameKo: `${TAG} 꼬부기` })
    .returning({ id: cards.id });

  const arts = await db
    .insert(artworks)
    .values([
      { cardId, artistName: `${TAG}wp`, format: "brg", status: "withdrawn", filesPurged: true },
      { cardId, artistName: `${TAG}wl`, format: "brg", status: "withdrawn", filesPurged: false },
      { cardId, artistName: `${TAG}a`, format: "brg", status: "active", filesPurged: false },
    ])
    .returning({ id: artworks.id });
  [withdrawnPurged, withdrawnLeftover, activeArt] = arts.map((r) => r.id);

  await db.insert(artworkFiles).values([
    { artworkId: withdrawnPurged, kind: "original", path: `artworks/${withdrawnPurged}/original-a`, mimeType: "application/pdf", sizeBytes: 1, position: 0 },
    { artworkId: withdrawnLeftover, kind: "original", path: `artworks/${withdrawnLeftover}/original-b`, mimeType: "application/pdf", sizeBytes: 1, position: 0 },
    { artworkId: activeArt, kind: "original", path: `artworks/${activeArt}/original-c`, mimeType: "application/pdf", sizeBytes: 1, position: 0 },
  ]);

  // report_throttle: 25h 전(오래됨), 1h 전(신선).
  const now = Date.now();
  const rows = await db
    .insert(reportThrottle)
    .values([
      { ipHash: `${TAG}-stale`, createdAt: new Date(now - 25 * 60 * 60 * 1000) },
      { ipHash: `${TAG}-fresh`, createdAt: new Date(now - 1 * 60 * 60 * 1000) },
    ])
    .returning({ id: reportThrottle.id });
  [staleThrottle, freshThrottle] = rows.map((r) => r.id);
});

afterAll(async () => {
  await db.delete(reportThrottle).where(inArray(reportThrottle.id, [staleThrottle, freshThrottle]));
  await db.delete(artworkFiles).where(inArray(artworkFiles.artworkId, [withdrawnPurged, withdrawnLeftover, activeArt]));
  await db.delete(artworks).where(inArray(artworks.id, [withdrawnPurged, withdrawnLeftover, activeArt]));
  await db.delete(cards).where(eq(cards.id, cardId));
  await db.delete(sets).where(eq(sets.code, SET_CODE));
});

describe("withdrawn & not-purged leftover 선별 (cleanup의 조인 쿼리)", () => {
  it("철회 + files_purged=false 작품의 파일만 고른다", async () => {
    const leftovers = await db
      .select({ path: artworkFiles.path })
      .from(artworkFiles)
      .innerJoin(artworks, eq(artworkFiles.artworkId, artworks.id))
      .where(and(eq(artworks.status, "withdrawn"), eq(artworks.filesPurged, false)));
    const paths = leftovers.map((r) => r.path);
    expect(paths).toContain(`artworks/${withdrawnLeftover}/original-b`);
    expect(paths).not.toContain(`artworks/${withdrawnPurged}/original-a`);
    expect(paths).not.toContain(`artworks/${activeArt}/original-c`);
  });
});

describe("trackedPaths 의미 (isNotNull + 정렬)", () => {
  it("추적 경로에 시드한 파일 경로가 모두 포함된다", async () => {
    const rows = await db
      .select({ path: artworkFiles.path })
      .from(artworkFiles)
      .where(isNotNull(artworkFiles.path))
      .orderBy(artworkFiles.path);
    const set = new Set(rows.map((r) => r.path));
    expect(set.has(`artworks/${withdrawnLeftover}/original-b`)).toBe(true);
    expect(set.has(`artworks/${activeArt}/original-c`)).toBe(true);
  });
});

describe("report_throttle 24h cutoff 삭제", () => {
  it("cutoff 이전만 삭제하고 개수를 돌려준다", async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const deleted = await db
      .delete(reportThrottle)
      .where(and(lt(reportThrottle.createdAt, cutoff), inArray(reportThrottle.id, [staleThrottle, freshThrottle])))
      .returning({ id: reportThrottle.id });
    expect(deleted.map((r) => r.id)).toEqual([staleThrottle]);
    // 신선한 건 남아 있다.
    const remain = await db.select().from(reportThrottle).where(eq(reportThrottle.id, freshThrottle));
    expect(remain).toHaveLength(1);
  });
});

// cleanup() 전체(listAll/remove 포함)는 Supabase Storage를 쓰므로 sub D(S3 전환)까지 보류.
