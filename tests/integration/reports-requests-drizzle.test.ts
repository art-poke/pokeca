import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { hashRange, ipRange, ReportError, submitReport } from "@/lib/reports";
import { cardExists, createRequest, recordDemandIfEmpty, requestState } from "@/lib/requests";
import { db } from "@/lib/db";
import {
  artworks,
  cardDemand,
  cards,
  consentEvents,
  events,
  reports,
  reportThrottle,
  requests,
  sets,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

// RPC 경유(report_submit / request_create / card_request_state)를 실제 로컬 Postgres(5432)에 검증한다.
// 자가 시드 후 정리. @/auth·스토리지에 의존하지 않도록 source_url 신고 위주로 쓴다.

const TAG = `rr${Date.now()}`;
const SET_CODE = `${TAG}set`;

let card: string; // 도안 있는 카드
let emptyCard: string; // active 도안 0개
let art: string;

beforeAll(async () => {
  await db.insert(sets).values({ code: SET_CODE, nameKo: `${TAG} 세트` });
  [{ id: card }, { id: emptyCard }] = await db
    .insert(cards)
    .values([
      { setCode: SET_CODE, collectorNumber: "201/165", nameKo: `${TAG} 리자몽` },
      { setCode: SET_CODE, collectorNumber: "202/165", nameKo: `${TAG} 뮤` },
    ])
    .returning({ id: cards.id });
  [{ id: art }] = await db
    .insert(artworks)
    .values({ cardId: card, artistName: `${TAG} 작가`, format: "9pocket", status: "active" })
    .returning({ id: artworks.id });
});

afterAll(async () => {
  await db.delete(events).where(inArray(events.cardId, [card, emptyCard]));
  await db.delete(requests).where(inArray(requests.cardId, [card, emptyCard]));
  await db.delete(cardDemand).where(inArray(cardDemand.cardId, [card, emptyCard]));
  await db.delete(reportThrottle).where(eq(reportThrottle.artworkId, art));
  await db.delete(reports).where(eq(reports.artworkId, art));
  // auto_hide 테스트가 artwork_set_status로 남긴 상태 변경 이력(cascade 없음)을 먼저 지운다.
  await db.delete(consentEvents).where(eq(consentEvents.artworkId, art));
  await db.delete(artworks).where(eq(artworks.id, art));
  await db.delete(cards).where(inArray(cards.id, [card, emptyCard]));
  await db.delete(sets).where(eq(sets.code, SET_CODE));
});

describe("submitReport (report_submit RPC)", () => {
  // 이 스위트가 만든 throttle/reports 행을 전부 추적해 테스트마다 지운다(공유 DB 재실행 안정화).
  const usedHashes = new Set<string>();
  const usedSources = new Set<string>();
  // secret에 TAG를 넣어 실행마다 서로 다른 IP 해시를 만든다(이전 실행과 충돌 금지).
  const hash = (ip: string) => {
    const h = hashRange(ip, `${TAG}secret`);
    usedHashes.add(h);
    return h;
  };
  const source = (path: string) => {
    const s = `https://${TAG}.example/${path}`;
    usedSources.add(s);
    return s;
  };

  afterEach(async () => {
    if (usedHashes.size) await db.delete(reportThrottle).where(inArray(reportThrottle.ipHash, [...usedHashes]));
    if (usedSources.size) await db.delete(reports).where(inArray(reports.sourceUrl, [...usedSources]));
    await db.delete(reports).where(eq(reports.artworkId, art));
    usedHashes.clear();
    usedSources.clear();
  });

  it("source_url 신고를 저장하고 auto_hide 아님", async () => {
    const src = source("a");
    const r = await submitReport(
      { artworkId: null, sourceUrl: src, reason: "other", contact: null, message: null },
      hash("203.0.113.9"),
    );
    expect(r.autoHidden).toBe(false);
    const row = await db.select().from(reports).where(eq(reports.id, r.id));
    expect(row[0]).toMatchObject({ sourceUrl: src, reason: "other", status: "open" });
  });

  it("없는 작품 신고는 not_found", async () => {
    await expect(
      submitReport(
        { artworkId: crypto.randomUUID(), sourceUrl: null, reason: "other", contact: null, message: null },
        hash("203.0.113.1"),
      ),
    ).rejects.toSatisfy((e) => e instanceof ReportError && e.code === "not_found");
  });

  it("같은 IP 24시간 5건 초과는 rate_limited", async () => {
    const h = hash("203.0.113.5");
    for (let i = 0; i < 5; i++) {
      await submitReport(
        { artworkId: null, sourceUrl: source(`r${i}`), reason: "other", contact: null, message: null },
        h,
      );
    }
    await expect(
      submitReport(
        { artworkId: null, sourceUrl: source("r6"), reason: "other", contact: null, message: null },
        h,
      ),
    ).rejects.toSatisfy((e) => e instanceof ReportError && e.code === "rate_limited");
  });

  it("서로 다른 대역 3곳이 같은 작품을 신고하면 auto_hide=true → setStatus 호출", async () => {
    // art는 파일이 없으므로 숨김 purge_paths가 비어 스토리지에 닿지 않는다.
    // hashRange는 /24 대역을 해시하므로 세 번째 옥텟이 서로 달라야 '다른 대역'이 된다.
    const base = { artworkId: art, sourceUrl: null, reason: "other" as const, contact: null, message: null };
    const r1 = await submitReport(base, hash("198.51.100.1"));
    expect(r1.autoHidden).toBe(false);
    const r2 = await submitReport(base, hash("198.51.101.1"));
    expect(r2.autoHidden).toBe(false);
    const r3 = await submitReport(base, hash("198.51.102.1"));
    expect(r3.autoHidden).toBe(true);

    const a = await db.select({ status: artworks.status }).from(artworks).where(eq(artworks.id, art));
    expect(a[0].status).toBe("hidden");
    // 원복(다른 테스트 영향 방지).
    await db.update(artworks).set({ status: "active" }).where(eq(artworks.id, art));
  });
});

describe("ipRange / hashRange", () => {
  it("IPv4는 /24로 묶고 같은 대역은 같은 해시", () => {
    expect(ipRange("203.0.113.9")).toBe("203.0.113.0/24");
    expect(hashRange("203.0.113.1", "s")).toBe(hashRange("203.0.113.254", "s"));
    expect(hashRange("203.0.113.1", "s")).not.toBe(hashRange("203.0.114.1", "s"));
  });
});

describe("requestState / createRequest (card_request_state + request_create RPC)", () => {
  afterEach(async () => {
    await db.delete(events).where(eq(events.cardId, card));
    await db.delete(requests).where(eq(requests.cardId, card));
  });

  it("요청 전에는 모든 규격 requested=false, waiting=null", async () => {
    const state = await requestState(card, crypto.randomUUID());
    expect(state["9pocket"]).toEqual({ requested: false, waiting: null });
    expect(state.psa.requested).toBe(false);
  });

  it("createRequest 후 본인은 requested=true, event 기록", async () => {
    const visitor = crypto.randomUUID();
    await createRequest(card, "9pocket", visitor);
    const state = await requestState(card, visitor);
    expect(state["9pocket"].requested).toBe(true);
    // 다른 방문자에게는 requested=false.
    const other = await requestState(card, crypto.randomUUID());
    expect(other["9pocket"].requested).toBe(false);

    const ev = await db.select().from(events).where(eq(events.cardId, card));
    expect(ev.some((e) => e.type === "request")).toBe(true);
  });

  it("같은 방문자·규격 중복 요청은 한 번만 센다", async () => {
    const visitor = crypto.randomUUID();
    await createRequest(card, "psa", visitor);
    await createRequest(card, "psa", visitor); // 중복 → no-op
    const rows = await db.select().from(requests).where(eq(requests.cardId, card));
    expect(rows.filter((r) => r.format === "psa")).toHaveLength(1);
  });

  it("3명 이상 요청하면 waiting 숫자 노출", async () => {
    for (let i = 0; i < 3; i++) await createRequest(card, "brg", crypto.randomUUID());
    const state = await requestState(card, crypto.randomUUID());
    expect(state.brg.waiting).toBe(3);
  });
});

describe("recordDemandIfEmpty / cardExists", () => {
  it("active 도안 0개인 카드 방문만 card_demand에 기록", async () => {
    const visitor = crypto.randomUUID();
    await recordDemandIfEmpty(emptyCard, visitor);
    const d1 = await db.select().from(cardDemand).where(eq(cardDemand.cardId, emptyCard));
    expect(d1).toHaveLength(1);

    // 도안 있는 카드는 기록하지 않는다.
    await recordDemandIfEmpty(card, visitor);
    const d2 = await db.select().from(cardDemand).where(eq(cardDemand.cardId, card));
    expect(d2).toHaveLength(0);

    // 방문자 없으면 no-op.
    await recordDemandIfEmpty(emptyCard, null);

    await db.delete(cardDemand).where(eq(cardDemand.cardId, emptyCard));
  });

  it("cardExists는 실제 카드만 true, 비UUID는 false", async () => {
    expect(await cardExists(card)).toBe(true);
    expect(await cardExists(crypto.randomUUID())).toBe(false);
    expect(await cardExists("not-a-uuid")).toBe(false);
  });
});
