// 행동 추적 이벤트 입력 검증 (app/api/events). 순수 함수 — DB·쿠키·요청은 라우트가 붙인다.
// page_view / page_leave / click 세 종류. source_click은 artwork→card 매핑이 필요해 라우트가 따로 다룬다.

export const TRACKED_TYPES = ["page_view", "page_leave", "click"] as const;
export type TrackedType = (typeof TRACKED_TYPES)[number];

// 흔한 크롤러/프리뷰 봇. 지표를 실유저 행동으로만 채우기 위한 느슨한 거름망(보안용 아님).
const BOT_UA =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|embedly|preview|pinterest|vkshare|validator|headless|lighthouse|monitoring/i;

export function isBot(userAgent: string | null): boolean {
  return !!userAgent && BOT_UA.test(userAgent);
}

function isTrackedType(v: unknown): v is TrackedType {
  return typeof v === "string" && (TRACKED_TYPES as readonly string[]).includes(v);
}

// 경로 정규화: '/'로 시작, 쿼리·해시 제거, 200자 컷. 아니면 null.
export function normalizePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;
  const path = trimmed.split(/[?#]/, 1)[0];
  if (!path) return null;
  return path.length > 200 ? path.slice(0, 200) : path;
}

// 운영자 자기 트래픽 1차 제외: 어드민·작가 콘솔 경로는 기록하지 않는다.
export function isExcludedPath(path: string): boolean {
  return (
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/artist" ||
    path.startsWith("/artist/")
  );
}

// 체류시간: 0~1시간 정수로 클램프(비정상값·조작 방지).
export function clampDwell(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(3_600_000, Math.max(0, Math.round(n)));
}

export type ParsedTracked =
  | { outcome: "ok"; type: TrackedType; payload: Record<string, unknown> }
  | { outcome: "skip" } // 봇·어드민/작가 경로 → 204, 기록 안 함
  | { outcome: "invalid" }; // → 400

// payload는 화이트리스트 필드(길이 제한)만 복사하므로 1KB 초과·임의 데이터가 들어올 수 없다.
export function parseTrackedEvent(body: unknown, userAgent: string | null): ParsedTracked {
  if (!body || typeof body !== "object") return { outcome: "invalid" };
  const b = body as Record<string, unknown>;
  const type = b.type;
  if (!isTrackedType(type)) {
    return { outcome: "invalid" };
  }
  const path = normalizePath(b.path);
  if (!path) return { outcome: "invalid" };
  if (isBot(userAgent)) return { outcome: "skip" };
  if (isExcludedPath(path)) return { outcome: "skip" };

  if (type === "page_view") {
    const ref = typeof b.ref === "string" && b.ref ? b.ref.slice(0, 200) : null;
    return { outcome: "ok", type, payload: { path, ref } };
  }
  if (type === "page_leave") {
    return { outcome: "ok", type, payload: { path, dwell_ms: clampDwell(b.dwell_ms) } };
  }
  // click
  const label = typeof b.label === "string" ? b.label.trim().slice(0, 100) : "";
  if (!label) return { outcome: "invalid" };
  return { outcome: "ok", type, payload: { path, label } };
}
