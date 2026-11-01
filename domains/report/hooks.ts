"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { REPORT_ENDPOINTS } from "./api/endpoints";
import type { ReportInput } from "./api/types";

// 신고 접수. 폼이 상태(limited/failed)를 직접 표시하므로 전역 토스트는 끈다.
export const useCreateReportMutation = () =>
  useMutation({
    mutationFn: (input: ReportInput) =>
      apiFetch<void>(REPORT_ENDPOINTS.create, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    meta: { skipGlobalError: true },
  });
