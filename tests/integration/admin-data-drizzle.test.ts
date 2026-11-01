import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeReport,
  evidenceUrl,
  findArtworksBySource,
  getAdminArtwork,
  linkReport,
  listAdminArtworks,
  listReports,
  setLinkStatus,
} from "@/lib/admin-data";
import { ArtworkError } from "@/lib/artworks";
import { db } from "@/lib/db";
import {
  artworkFiles,
  artworks,
  cards,
  consentEvents,
  reports,
  sets,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

// admin-data.ts Drizzle 전환 검증(비스토리지 경로만). 로컬 Docker Postgres(5432)에 자가 시드 후 정리.
// 스토리지(.storage.*)가 얽힌 signedEvidenceUrl 경로는 sub D까지 보류 — evidenceUrl의 "경로 없음→null"만 본다.

const TAG = `ad${Date.now()}`;
const SET_CODE = `${TAG}set`;

let cardA: string;
let artworkLinked: string; // source_url 있고 점검 전 → needsCheck
let artworkWithdrawn: string; // 철회 → needsCheck=false
let artworkNoSource: string; // source_url 없음 → needsCheck=false
let openReportId: string;
let evidenceEventId: number;

beforeAll(async () => {
  await db.insert(sets).values({ code: SET_CODE, nameKo: `${TAG} 세트` });
  [{ id: cardA }] = await db
    .insert(cards)
    .values({ setCode: SET_CODE, collectorNumber: "001/165", nameKo: `${TAG} 피카츄` })
    .returning({ id: cards.id });

  const inserted = await db
    .insert(artworks)
    .values([
      {
        cardId: cardA,
        artistName: `${TAG}linked`,
        format: "brg",
        sourceUrl: `https://cafe.naver.com/${TAG}/1`,
        sourceVisibility: "public",
        status: "active",
      },
      {
        cardId: cardA,
        artistName: `${TAG}withdrawn`,
        format: "brg",
        sourceUrl: `https://cafe.naver.com/${TAG}/2`,
        sourceVisibility: "public",
        status: "withdrawn",
      },
      {
        cardId: cardA,
        artistName: `${TAG}nosource`,
        format: "brg",
        sourceUrl: null,
        sourceVisibility: null,
        status: "active",
      },
    ])
    .returning({ id: artworks.id });
  [artworkLinked, artworkWithdrawn, artworkNoSource] = inserted.map((r) => r.id);

  await db.insert(artworkFiles).values([
    { artworkId: artworkLinked, kind: "original", path: `artworks/${artworkLinked}/original-x`, mimeType: "application/pdf", sizeBytes: 100, position: 0 },
    { artworkId: artworkLinked, kind: "thumbnail", path: `artworks/${artworkLinked}/thumbnail-x`, mimeType: "image/png", sizeBytes: 50, position: 0 },
  ]);

  const evt = await db
    .insert(consentEvents)
    .values({
      artworkId: artworkLinked,
      kind: "created",
      after: { status: "active" },
      actor: "test",
      evidencePath: `artworks/${artworkLinked}/evidence-1`,
    })
    .returning({ id: consentEvents.id });
  evidenceEventId = evt[0].id;

  const rep = await db
    .insert(reports)
    .values({
      artworkId: artworkLinked,
      sourceUrl: `https://cafe.naver.com/${TAG}/1`,
      reason: "rights_holder",
      status: "open",
    })
    .returning({ id: reports.id });
  openReportId = rep[0].id;
});

afterAll(async () => {
  const ids = [artworkLinked, artworkWithdrawn, artworkNoSource];
  await db.delete(reports).where(inArray(reports.artworkId, ids));
  await db.delete(consentEvents).where(inArray(consentEvents.artworkId, ids));
  await db.delete(artworkFiles).where(inArray(artworkFiles.artworkId, ids));
  await db.delete(artworks).where(inArray(artworks.id, ids));
  await db.delete(cards).where(eq(cards.id, cardA));
  await db.delete(sets).where(eq(sets.code, SET_CODE));
});

describe("listAdminArtworks", () => {
  it("카드 조인·needsCheck 우선 정렬, 상태 필터", async () => {
    const all = (await listAdminArtworks()).filter((r) => r.setCode === SET_CODE);
    expect(all).toHaveLength(3);
    // needsCheck가 먼저.
    expect(all[0].needsCheck).toBe(true);
    const linked = all.find((r) => r.id === artworkLinked)!;
    expect(linked).toMatchObject({ setCode: SET_CODE, collectorNumber: "001/165", needsCheck: true });

    const active = (await listAdminArtworks({ status: "withdrawn" })).filter((r) => r.setCode === SET_CODE);
    expect(active.map((r) => r.id)).toEqual([artworkWithdrawn]);
    expect(active[0].needsCheck).toBe(false);
  });

  it("needsCheck 필터", async () => {
    const needs = (await listAdminArtworks({ needsCheck: true })).filter((r) => r.setCode === SET_CODE);
    expect(needs.map((r) => r.id)).toEqual([artworkLinked]);
  });
});

describe("getAdminArtwork", () => {
  it("파일·이벤트·신고를 모아 상세 반환", async () => {
    const d = await getAdminArtwork(artworkLinked);
    expect(d).not.toBeNull();
    expect(d!.cardName).toBe(`${TAG} 피카츄`);
    expect(d!.files).toHaveLength(2);
    expect(d!.files.map((f) => f.kind).sort()).toEqual(["original", "thumbnail"]);
    expect(d!.events).toHaveLength(1);
    expect(d!.events[0].evidencePath).toBe(`artworks/${artworkLinked}/evidence-1`);
    expect(d!.reports).toHaveLength(1);
    expect(d!.reports[0].id).toBe(openReportId);
    expect(d!.artistAccount).toBeNull();
  });

  it("비UUID는 null", async () => {
    expect(await getAdminArtwork("not-a-uuid")).toBeNull();
  });
});

describe("setLinkStatus (rpc artwork_set_link_status)", () => {
  it("상태·점검시각 갱신", async () => {
    await setLinkStatus(artworkLinked, "ok");
    const row = await db.select().from(artworks).where(eq(artworks.id, artworkLinked)).limit(1);
    expect(row[0].linkStatus).toBe("ok");
    expect(row[0].linkCheckedAt).not.toBeNull();
    // 점검 후 needsCheck=false.
    const list = (await listAdminArtworks({ needsCheck: true })).filter((r) => r.setCode === SET_CODE);
    expect(list.find((r) => r.id === artworkLinked)).toBeUndefined();
  });

  it("없는 id → ArtworkError('not_found')", async () => {
    await expect(setLinkStatus(crypto.randomUUID(), "ok")).rejects.toMatchObject({
      constructor: ArtworkError,
      message: "not_found",
    });
  });

  it("잘못된 상태 → ArtworkError('invalid_link_status')", async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setLinkStatus(artworkLinked, "bogus" as any),
    ).rejects.toMatchObject({ constructor: ArtworkError, message: "invalid_link_status" });
  });
});

describe("evidenceUrl (비스토리지 부분만)", () => {
  it("잘못된 eventId는 null", async () => {
    expect(await evidenceUrl("0")).toBeNull();
    expect(await evidenceUrl("abc")).toBeNull();
  });

  it("경로 없는 이벤트는 null (서명 호출 안 함)", async () => {
    const noPath = await db
      .insert(consentEvents)
      .values({ artworkId: artworkLinked, kind: "status", after: {}, actor: "t", evidencePath: null })
      .returning({ id: consentEvents.id });
    expect(await evidenceUrl(String(noPath[0].id))).toBeNull();
  });
  // 경로가 있는 이벤트의 서명 URL 발급은 Supabase Storage(signedEvidenceUrl) — sub D까지 보류.
});

describe("listReports / findArtworksBySource / linkReport / closeReport", () => {
  it("열림 신고에 작품 라벨이 붙는다", async () => {
    const all = await listReports();
    const mine = all.find((r) => r.id === openReportId)!;
    expect(mine.status).toBe("open");
    expect(mine.artworkId).toBe(artworkLinked);
    expect(mine.artworkLabel).toBe(`${SET_CODE} 001/165 · @${TAG}linked · brg`);
  });

  it("source_url ilike로 후보 작품 검색", async () => {
    const found = await findArtworksBySource(`https://cafe.naver.com/${TAG}/1?utm=x`);
    expect(found.some((r) => r.id === artworkLinked)).toBe(true);
  });

  it("linkReport는 열림 신고만 갱신, 중복/없음은 not_found", async () => {
    const orphan = await db
      .insert(reports)
      .values({ artworkId: null, sourceUrl: `https://x/${TAG}`, reason: "other", status: "open" })
      .returning({ id: reports.id });
    await linkReport(orphan[0].id, artworkLinked);
    const row = await db.select().from(reports).where(eq(reports.id, orphan[0].id)).limit(1);
    expect(row[0].artworkId).toBe(artworkLinked);
    // 더 이상 열림이 아니어도 아님 — status는 그대로 open이므로 다시 링크는 성공한다. 없는 id는 not_found.
    await expect(linkReport(crypto.randomUUID(), artworkLinked)).rejects.toMatchObject({ message: "not_found" });
    await db.delete(reports).where(eq(reports.id, orphan[0].id));
  });

  it("closeReport는 열림을 닫고, 닫힌 신고 재시도는 not_found", async () => {
    await closeReport(openReportId, "resolved", "  처리함  ");
    const row = await db.select().from(reports).where(eq(reports.id, openReportId)).limit(1);
    expect(row[0].status).toBe("resolved");
    expect(row[0].resolutionNote).toBe("처리함");
    expect(row[0].resolvedAt).not.toBeNull();
    await expect(closeReport(openReportId, "resolved", "x")).rejects.toMatchObject({ message: "not_found" });
  });
});
