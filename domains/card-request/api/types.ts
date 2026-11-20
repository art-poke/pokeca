import type { Format } from "@/lib/formats";

export type RequestStatus = { requested: boolean; waiting: number | null };

// 규격별 요청 현황(계정별).
export type CardRequestsMap = Record<Format, RequestStatus>;
