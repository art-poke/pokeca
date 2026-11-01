"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { ADMIN_ARTWORK_ENDPOINTS, areaEndpoints } from "./api/endpoints";
import type {
  AdminCardHit,
  AttachFileInput,
  CreateArtworkResult,
  UpdateArtworkResult,
  UploadArea,
} from "./api/types";

// 내부 도구(어드민/작가). 폼이 인라인 에러를 직접 표시하므로 mutateAsync로 쓴다 → skipGlobalError.

// 카드 검색(타입어헤드). mutation으로 on-demand 호출.
export const useSearchCardsMutation = (area: UploadArea) =>
  useMutation({
    mutationFn: (q: string) =>
      apiFetch<AdminCardHit[]>(areaEndpoints(area).cards(q)),
    meta: { skipGlobalError: true },
  });

export const useCreateArtworkMutation = (area: UploadArea) =>
  useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<CreateArtworkResult>(areaEndpoints(area).artworks, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    meta: { skipGlobalError: true },
  });

export const useUpdateArtworkMutation = (id: string) =>
  useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<UpdateArtworkResult>(ADMIN_ARTWORK_ENDPOINTS.update(id), {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    meta: { skipGlobalError: true },
  });

export const useAttachArtworkFileMutation = (id: string) =>
  useMutation({
    mutationFn: (input: AttachFileInput) =>
      apiFetch<void>(ADMIN_ARTWORK_ENDPOINTS.files(id), {
        method: "POST",
        body: JSON.stringify(input),
      }),
    meta: { skipGlobalError: true },
  });
