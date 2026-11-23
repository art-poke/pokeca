import type { Filters } from "@/lib/analytics/report";

export const topics = {
  traffic: "방문 트래픽",
  growth: "회원 성장",
  channels: "유입 채널",
  conversion: "가입 전환",
  retention: "회원 리텐션",
  search: "검색 퍼널",
  games: "게임 참여",
  activity: "기능별 활동",
  requests: "도안 요청",
} as const;
export type Topic = keyof typeof topics;
export function detailUrl(topic: Topic, q: Filters) {
  return reportUrl("/admin/insights/" + topic, q);
}
export function reportUrl(path: string, q: Filters) {
  const params = new URLSearchParams();
  for (const key of ["range", "from", "to", "unit"])
    if (typeof q[key] === "string") params.set(key, q[key]);
  return params.size ? path + "?" + params : path;
}
export const num = (v: number) => v.toLocaleString("ko-KR");
export const pct = (v: number, n: number) =>
  n ? ((v * 100) / n).toFixed(1) + "%" : "—";
export const signed = (v: number) => (v > 0 ? "+" : "") + num(v);
