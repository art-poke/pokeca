import { describe, expect, it } from "vitest";
import { rangeStartUtc, toRange } from "./admin-insights";

// KST = UTC+9, DST 없음. 경계는 UTC instant로 돌려줘야 events 인덱스를 탄다.
describe("rangeStartUtc", () => {
  it("today = KST midnight expressed in UTC (prev day 15:00Z)", () => {
    // 2026-11-17 02:00Z = 2026-11-17 11:00 KST → KST 오늘 0시 = 2026-11-16 15:00Z
    const now = new Date("2026-11-17T02:00:00Z");
    expect(rangeStartUtc("today", now).toISOString()).toBe("2026-11-16T15:00:00.000Z");
  });

  it("handles the KST day being ahead of UTC", () => {
    // 2026-11-17 16:00Z = 2026-11-18 01:00 KST → KST 오늘(18일) 0시 = 2026-11-17 15:00Z
    const now = new Date("2026-11-17T16:00:00Z");
    expect(rangeStartUtc("today", now).toISOString()).toBe("2026-11-17T15:00:00.000Z");
  });

  it("7d spans 6 days back, 30d spans 29 days back from KST midnight", () => {
    const now = new Date("2026-11-17T02:00:00Z"); // KST today 0시 = 11-16 15:00Z
    expect(rangeStartUtc("7d", now).toISOString()).toBe("2026-11-10T15:00:00.000Z");
    expect(rangeStartUtc("30d", now).toISOString()).toBe("2026-10-18T15:00:00.000Z");
  });
});

describe("toRange", () => {
  it("defaults unknown/undefined to 7d, passes today/30d", () => {
    expect(toRange(undefined)).toBe("7d");
    expect(toRange("weird")).toBe("7d");
    expect(toRange("today")).toBe("today");
    expect(toRange("30d")).toBe("30d");
  });
});
