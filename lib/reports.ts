import "server-only";
import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { setStatus } from "@/lib/artworks";
import { UUID } from "@/lib/uuid";

// plpgsql의 `raise exception '<code>'`은 pg 에러 message로 올라오고, Drizzle는 그 에러를 .cause 체인에
// 감싼다. report_submit이 던지는 코드만 추려 ReportError로 올린다.
const REPORT_RPC_CODES = ["rate_limited", "not_found"] as const;
function reportRpcCode(e: unknown): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = e;
  for (let i = 0; i < 5 && cur; i++) {
    if (typeof cur.message === "string" && (REPORT_RPC_CODES as readonly string[]).includes(cur.message)) {
      return cur.message;
    }
    cur = cur.cause;
  }
  return undefined;
}

// 신고·내림 요청 (설계 "신고 흐름", design 14A).
//   저장 → (같은 작품에 24시간 안 서로 다른 IP 대역 3곳) 자동 숨김 → 어드민 검수
// IP는 남용 방지에만 쓴다. 대역으로 자른 뒤 서버 비밀값으로 HMAC해서 24시간 카운터에만 남긴다.

export const REASONS = ["rights_holder", "suspected_theft", "other"] as const;
export type Reason = (typeof REASONS)[number];

export class ReportError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

// IPv4는 /24, IPv6는 /48. 같은 집·회사에서 주소만 바꿔 여러 번 신고하는 것을 한 곳으로 센다.
export function ipRange(ip: string): string {
  const v4 = ip.match(/^(?:::ffff:)?(\d+)\.(\d+)\.(\d+)\.\d+$/i);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  if (ip.includes(":")) {
    const [head, tail = ""] = ip.toLowerCase().split("::");
    const left = head ? head.split(":") : [];
    const right = tail ? tail.split(":") : [];
    const full = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
    return `${full.slice(0, 3).map((g) => parseInt(g || "0", 16).toString(16)).join(":")}::/48`;
  }
  return "unknown";
}

export function hashRange(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ipRange(ip)).digest("hex");
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}

export type NewReport = {
  artworkId: string | null;
  sourceUrl: string | null;
  reason: Reason;
  contact: string | null;
  message: string | null;
};

export function parseReport(input: unknown): NewReport {
  if (!input || typeof input !== "object") throw new ReportError("invalid_reason");
  const body = input as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const artworkId = text(body.artworkId, 36);
  const sourceUrl = text(body.sourceUrl, 2000);
  if (!REASONS.includes(body.reason as Reason)) throw new ReportError("invalid_reason");
  if (artworkId && !UUID.test(artworkId)) throw new ReportError("not_found");
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) throw new ReportError("invalid_source_url");
  if (!artworkId && !sourceUrl) throw new ReportError("target_required");
  return { artworkId, sourceUrl, reason: body.reason as Reason, contact: text(body.contact, 200), message: text(body.message, 2000) };
}

export async function submitReport(report: NewReport, ipHash: string): Promise<{ id: string; autoHidden: boolean }> {
  const pReport = {
    artwork_id: report.artworkId,
    source_url: report.sourceUrl,
    reason: report.reason,
    contact: report.contact,
    message: report.message,
  };
  let data: { id: string; auto_hide: boolean };
  try {
    // 신고 저장·한도·자동숨김 판정은 plpgsql 함수(report_submit)가 한 트랜잭션에서 처리한다.
    const result = await db.execute(
      sql`select public.report_submit(${JSON.stringify(pReport)}::jsonb, ${ipHash}) as r`,
    );
    data = (result.rows[0] as { r: { id: string; auto_hide: boolean } }).r;
  } catch (e) {
    const code = reportRpcCode(e);
    if (code) throw new ReportError(code);
    throw e;
  }
  const { id, auto_hide } = data;
  let autoHidden = false;
  if (auto_hide && report.artworkId) {
    const result = await setStatus(report.artworkId, "hidden", {
      reason: "서로 다른 대역 3곳에서 신고되어 자동으로 숨김",
      actor: "system:reports",
    }).catch((e) => {
      // 이미 철회된 작품 등은 숨길 필요가 없다.
      console.error("auto hide failed", e);
      return null;
    });
    autoHidden = !!result?.changed;
  }
  return { id, autoHidden };
}
