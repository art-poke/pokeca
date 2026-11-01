"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { ARTIST_ENDPOINTS } from "./api/endpoints";
import { artistKeys } from "./api/queries";
import type { ArtistHit } from "./api/types";

// 작가 이름/핸들 검색. q가 비면 비활성(요청 안 함). 같은 q는 캐시 재사용.
export const useArtistSearchQuery = (q: string) =>
  useQuery({
    queryKey: artistKeys.search(q),
    queryFn: () =>
      apiFetch<ArtistHit[]>(
        `${ARTIST_ENDPOINTS.search}?q=${encodeURIComponent(q)}`,
      ),
    enabled: q.trim().length > 0,
    staleTime: 5 * 60 * 1000,
  });
